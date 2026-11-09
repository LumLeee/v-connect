"""Bounded, offline CPU embeddings for matching.

Only the management command downloads model files. HTTP requests use a prepared,
pinned ONNX model and fall back to matching rules when this service is unavailable.
"""
import hashlib
import json
import math
import threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path

from django.conf import settings

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
MODEL_REPOSITORY = "Qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q"
MODEL_REVISION = "faf4aa4225822f3bc6376869cb1164e8e3feedd0"
EMBEDDING_DIMENSIONS = 384
MANIFEST_NAME = "model-manifest.json"
MODEL_FILES = (
    "config.json", "model_optimized.onnx", "special_tokens_map.json",
    "tokenizer.json", "tokenizer_config.json",
)


class EmbeddingUnavailable(Exception):
    """A public, fixed reason code; never includes input text or provider errors."""

    def __init__(self, reason):
        self.reason = reason
        super().__init__(reason)


@dataclass(frozen=True)
class _Configuration:
    model: str
    directory: Path
    threads: int
    cache_size: int
    max_texts: int
    max_text_chars: int
    timeout: float


def _configuration():
    if not getattr(settings, "MATCHING_AI_ENABLED", True):
        raise EmbeddingUnavailable("disabled")
    try:
        config = _Configuration(
            model=str(getattr(settings, "MATCHING_AI_MODEL", MODEL_NAME)),
            directory=Path(getattr(settings, "MATCHING_AI_MODEL_DIR", settings.BASE_DIR / ".models" / "matching")).resolve(),
            threads=int(getattr(settings, "MATCHING_AI_THREADS", 2)),
            cache_size=int(getattr(settings, "MATCHING_AI_CACHE_SIZE", 2048)),
            max_texts=int(getattr(settings, "MATCHING_AI_MAX_TEXTS", 512)),
            max_text_chars=int(getattr(settings, "MATCHING_AI_MAX_TEXT_CHARS", 2000)),
            timeout=float(getattr(settings, "MATCHING_AI_TIMEOUT", 10)),
        )
        if (config.model != MODEL_NAME or not 1 <= config.threads <= 16
                or not 0 <= config.cache_size <= 10000 or not 1 <= config.max_texts <= 2048
                or not 1 <= config.max_text_chars <= 10000
                or not math.isfinite(config.timeout) or not 0 < config.timeout <= 60):
            raise ValueError
        return config
    except (TypeError, ValueError, OSError):
        raise EmbeddingUnavailable("configuration") from None


def file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_manifest(directory):
    """Build the readiness marker after a pinned download and successful self-test."""
    return {
        "format": 1, "model": MODEL_NAME, "repository": MODEL_REPOSITORY,
        "revision": MODEL_REVISION, "dimensions": EMBEDDING_DIMENSIONS,
        "files": {name: file_sha256(Path(directory) / name) for name in MODEL_FILES},
    }


def validate_local_model(directory):
    """Verify each asset once per generation, inside the bounded worker."""
    directory = Path(directory)
    try:
        manifest = json.loads((directory / MANIFEST_NAME).read_text(encoding="utf-8"))
        if (manifest.get("format") != 1 or manifest.get("model") != MODEL_NAME
                or manifest.get("repository") != MODEL_REPOSITORY
                or manifest.get("revision") != MODEL_REVISION
                or manifest.get("dimensions") != EMBEDDING_DIMENSIONS
                or set(manifest.get("files", {})) != set(MODEL_FILES)):
            raise ValueError
        if any(file_sha256(directory / name) != manifest["files"][name] for name in MODEL_FILES):
            raise ValueError
        return manifest
    except FileNotFoundError:
        raise EmbeddingUnavailable("model_missing") from None
    except (OSError, TypeError, ValueError, AttributeError):
        raise EmbeddingUnavailable("model_invalid") from None


def _generation(config):
    # Stat checks are cheap; hashing the 200+ MB weights happens only on model load.
    try:
        return tuple((name, (stat := (config.directory / name).stat()).st_mtime_ns, stat.st_size)
                     for name in (MANIFEST_NAME, *MODEL_FILES))
    except FileNotFoundError:
        raise EmbeddingUnavailable("model_missing") from None
    except OSError:
        raise EmbeddingUnavailable("model_invalid") from None


def _create_embedder(directory, threads):
    try:
        embedding_class = import_module("fastembed").TextEmbedding
    except (ImportError, OSError):
        raise EmbeddingUnavailable("dependencies_missing") from None
    return embedding_class(
        model_name=MODEL_NAME, specific_model_path=str(directory),
        cache_dir=str(directory), local_files_only=True,
        providers=["CPUExecutionProvider"], threads=threads, lazy_load=False,
    )


def normalized_vectors(vectors, count):
    """Reject a partial/invalid batch rather than mixing AI and rule scores."""
    try:
        vectors = list(vectors)
        if len(vectors) != count:
            raise ValueError
        result = []
        for vector in vectors:
            values = [float(value) for value in vector]
            if len(values) != EMBEDDING_DIMENSIONS or not all(math.isfinite(value) for value in values):
                raise ValueError
            norm = math.sqrt(sum(value * value for value in values))
            if not math.isfinite(norm) or norm <= 0:
                raise ValueError
            result.append(tuple(value / norm for value in values))
        return result
    except (TypeError, ValueError, OverflowError):
        raise EmbeddingUnavailable("invalid_output") from None


class _Engine:
    def __init__(self, config, generation):
        self.config = config
        self.generation = generation
        self.embedder = None
        self.cache = OrderedDict()
        self.cache_lock = threading.Lock()

    def cached(self, texts):
        with self.cache_lock:
            found = {}
            for text in texts:
                if text in self.cache:
                    found[text] = self.cache[text]
                    self.cache.move_to_end(text)
            return found

    def encode(self, texts):
        try:
            if self.embedder is None:
                validate_local_model(self.config.directory)
                self.embedder = _create_embedder(self.config.directory, self.config.threads)
            vectors = normalized_vectors(
                self.embedder.embed(texts, batch_size=16, parallel=None), len(texts),
            )
            encoded = dict(zip(texts, vectors))
            # Commit the entire valid batch together, including a job whose caller
            # timed out. A later request can reuse that completed work safely.
            with self.cache_lock:
                for text, vector in encoded.items():
                    self.cache[text] = vector
                    self.cache.move_to_end(text)
                while len(self.cache) > self.config.cache_size:
                    self.cache.popitem(last=False)
            return encoded
        except EmbeddingUnavailable:
            raise
        except Exception:
            raise EmbeddingUnavailable("inference_failed") from None


_state_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="matching-embedding")
_engine = None
_job = None


def embed_texts(texts):
    """Return normalized 384D vectors, or a fixed fallback reason.

    A process has at most one inference job and no queued jobs. When a caller
    times out the existing job keeps its slot until it actually finishes.
    """
    global _engine, _job
    config = _configuration()
    if not isinstance(texts, (list, tuple)) or not texts:
        raise EmbeddingUnavailable("invalid_input")
    if len(texts) > config.max_texts:
        raise EmbeddingUnavailable("batch_too_large")
    if any(not isinstance(text, str) or not text.strip() or len(text) > config.max_text_chars for text in texts):
        raise EmbeddingUnavailable("invalid_input")
    generation = _generation(config)
    unique = list(dict.fromkeys(texts))
    with _state_lock:
        if _engine is None or _engine.config != config or _engine.generation != generation:
            if _job is not None and not _job.done():
                raise EmbeddingUnavailable("busy")
            _engine = _Engine(config, generation)
        engine = _engine
        cached = engine.cached(unique)
        missing = [text for text in unique if text not in cached]
        if missing:
            if _job is not None and not _job.done():
                raise EmbeddingUnavailable("busy")
            _job = _executor.submit(engine.encode, missing)
            job = _job
    if missing:
        try:
            cached.update(job.result(timeout=config.timeout))
        except FutureTimeout:
            raise EmbeddingUnavailable("timeout") from None
    # Return copies so a caller cannot mutate the shared cache.
    return [list(cached[text]) for text in texts]


def reset_embedding_state():
    """Drop an idle model/cache, e.g. after settings changes in tests."""
    global _engine, _job
    with _state_lock:
        if _job is not None and not _job.done():
            raise RuntimeError("Cannot reset a running embedding job.")
        _engine = None
        _job = None

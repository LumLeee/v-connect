"""Explicit, pinned download; this command does not access application data."""
import json
import shutil
import uuid
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.recommendations.embeddings import (
    EMBEDDING_DIMENSIONS, MANIFEST_NAME, MODEL_FILES, MODEL_NAME, MODEL_REPOSITORY,
    MODEL_REVISION, EmbeddingUnavailable, _create_embedder, model_manifest,
    normalized_vectors, validate_local_model,
)


def _download_assets(directory):
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        raise CommandError("Install backend requirements before preparing the matching model.") from None
    for filename in MODEL_FILES:
        hf_hub_download(
            repo_id=MODEL_REPOSITORY, revision=MODEL_REVISION, filename=filename,
            local_dir=str(directory), token=False, local_files_only=False,
            etag_timeout=20,
        )


def _self_test(directory, threads):
    embedder = _create_embedder(directory, threads)
    normalized_vectors(embedder.embed(
        ["Hỗ trợ cộng đồng và hướng dẫn công nghệ.", "Community volunteering and technology support."],
        batch_size=2, parallel=None,
    ), 2)


def _remove_staging(directory, parent):
    """Delete only our freshly allocated staging child, never a configured model."""
    resolved, root = directory.resolve(), parent.resolve()
    if resolved.parent != root or ".staging-" not in resolved.name or directory.is_symlink():
        raise CommandError("Refusing to remove a path outside the model staging directory.")
    if resolved.exists():
        shutil.rmtree(resolved)


class Command(BaseCommand):
    help = "Download and validate the pinned multilingual ONNX matching model (CPU, no database needed)."
    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Replace an existing model after staging and validation.")

    def handle(self, *args, **options):
        if str(getattr(settings, "MATCHING_AI_MODEL", MODEL_NAME)) != MODEL_NAME:
            raise CommandError(f"This command prepares only {MODEL_NAME}.")
        directory = Path(getattr(settings, "MATCHING_AI_MODEL_DIR", settings.BASE_DIR / ".models" / "matching")).resolve()
        threads = int(getattr(settings, "MATCHING_AI_THREADS", 2))
        if not 1 <= threads <= 16 or directory == directory.parent:
            raise CommandError("Invalid matching model directory or thread count.")
        if directory.exists() and (not directory.is_dir() or (
                any(directory.iterdir()) and not (directory / MANIFEST_NAME).is_file()
                and not (directory / "model_optimized.onnx").is_file())):
            raise CommandError("Configured model directory contains unrelated files; choose an empty model directory.")
        parent = directory.parent
        parent.mkdir(parents=True, exist_ok=True)
        lock = parent / f".{directory.name}.prepare.lock"
        try:
            lock_file = lock.open("x", encoding="utf-8")
        except FileExistsError:
            raise CommandError("Another model preparation is running; wait for it to finish.") from None
        staging = parent / f".{directory.name}.staging-{uuid.uuid4().hex}"
        try:
            with lock_file:
                lock_file.write(MODEL_REVISION)
            if not options["force"]:
                try:
                    validate_local_model(directory)
                    _self_test(directory, threads)
                    self.stdout.write(self.style.SUCCESS(
                        f"Matching model is ready: {directory} ({EMBEDDING_DIMENSIONS} dimensions, CPU)."
                    ))
                    return
                except EmbeddingUnavailable:
                    pass
            staging.mkdir()
            self.stdout.write(f"Downloading {MODEL_REPOSITORY} at {MODEL_REVISION}...")
            _download_assets(staging)
            _self_test(staging, threads)
            manifest = model_manifest(staging)
            (staging / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            validate_local_model(staging)
            backup = None
            if directory.exists():
                backup = parent / f".{directory.name}.backup-{uuid.uuid4().hex}"
                directory.rename(backup)
            try:
                staging.rename(directory)
            except OSError:
                if backup is not None and not directory.exists():
                    backup.rename(directory)
                raise
            self.stdout.write(self.style.SUCCESS(
                f"Matching model is ready: {directory} ({EMBEDDING_DIMENSIONS} dimensions, CPU)."
            ))
            if backup is not None:
                self.stdout.write(f"Previous files preserved at: {backup}")
        except CommandError:
            raise
        except EmbeddingUnavailable as exc:
            raise CommandError(f"Matching model self-test failed: {exc.reason}.") from None
        except Exception:
            # Do not print provider exceptions, auth headers or local configuration.
            raise CommandError("Could not prepare the matching model. Check the network and available disk space, then retry.") from None
        finally:
            if staging.exists():
                _remove_staging(staging, parent)
            lock.unlink(missing_ok=True)

import io
import json
import tempfile
import threading
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from apps.recommendations import embeddings
from apps.recommendations.management.commands import prepare_matching_model as prepare


def vector(a=3, b=4):
    return [a, b, *([0] * (embeddings.EMBEDDING_DIMENSIONS - 2))]


class EmbeddingTests(SimpleTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="v-connect-embedding-")
        self.directory = Path(self.temporary.name) / "matching"
        self.directory.mkdir()
        self.write_model()
        self.override = override_settings(
            MATCHING_AI_ENABLED=True, MATCHING_AI_MODEL=embeddings.MODEL_NAME,
            MATCHING_AI_MODEL_DIR=self.directory, MATCHING_AI_THREADS=2,
            MATCHING_AI_CACHE_SIZE=3, MATCHING_AI_MAX_TEXTS=8,
            MATCHING_AI_MAX_TEXT_CHARS=2000, MATCHING_AI_TIMEOUT=2,
        )
        self.override.enable()
        embeddings.reset_embedding_state()
        self.addCleanup(self.temporary.cleanup)
        self.addCleanup(self.override.disable)
        self.addCleanup(embeddings.reset_embedding_state)

    def write_model(self):
        for name in embeddings.MODEL_FILES:
            (self.directory / name).write_text("test-asset", encoding="utf-8")
        self.write_manifest()

    def write_manifest(self):
        (self.directory / embeddings.MANIFEST_NAME).write_text(
            json.dumps(embeddings.model_manifest(self.directory)), encoding="utf-8",
        )

    def unavailable(self, reason, texts=None):
        with self.assertRaises(embeddings.EmbeddingUnavailable) as caught:
            embeddings.embed_texts(["volunteer"] if texts is None else texts)
        self.assertEqual(caught.exception.reason, reason)
        self.assertEqual(str(caught.exception), reason)

    def fake_embedder(self):
        return SimpleNamespace(embed=Mock(side_effect=lambda texts, **kwargs: [vector() for _ in texts]))

    @override_settings(MATCHING_AI_ENABLED=False)
    def test_disabled_never_reads_model_or_imports_inference_dependency(self):
        # Nested override is applied after setUp's enabled override.
        with override_settings(MATCHING_AI_ENABLED=False), patch.object(embeddings, "_create_embedder") as loader:
            self.unavailable("disabled")
        loader.assert_not_called()

    def test_missing_model_and_bad_configuration_are_fast_fallbacks(self):
        with override_settings(MATCHING_AI_MODEL_DIR=self.directory / "missing"):
            self.unavailable("model_missing")
        for changed in [
            {"MATCHING_AI_MODEL": "untrusted/model"}, {"MATCHING_AI_THREADS": 0},
            {"MATCHING_AI_TIMEOUT": float("nan")}, {"MATCHING_AI_CACHE_SIZE": -1},
        ]:
            with self.subTest(changed=changed), override_settings(**changed):
                self.unavailable("configuration")

    def test_input_count_content_and_length_are_bounded(self):
        for texts in [[], "text", [None], ["  "], ["x" * 2001]]:
            with self.subTest(texts_type=type(texts).__name__):
                self.unavailable("invalid_input", texts)
        self.unavailable("batch_too_large", ["text"] * 9)

    def test_missing_optional_dependency_does_not_break_backend(self):
        with patch.object(embeddings, "import_module", side_effect=ImportError("local missing dependency")):
            self.unavailable("dependencies_missing")

    def test_loader_uses_only_explicit_local_files_and_cpu(self):
        fake = self.fake_embedder()
        factory = Mock(return_value=fake)
        with patch.object(embeddings, "import_module", return_value=SimpleNamespace(TextEmbedding=factory)):
            result = embeddings.embed_texts(["Hỗ trợ cộng đồng"])
        factory.assert_called_once_with(
            model_name=embeddings.MODEL_NAME, specific_model_path=str(self.directory),
            cache_dir=str(self.directory), local_files_only=True,
            providers=["CPUExecutionProvider"], threads=2, lazy_load=False,
        )
        fake.embed.assert_called_once_with(["Hỗ trợ cộng đồng"], batch_size=16, parallel=None)
        self.assertAlmostEqual(sum(value * value for value in result[0]), 1)
        self.assertEqual(result[0][:2], [.6, .8])

    def test_cache_deduplicates_preserves_order_and_returns_copies(self):
        fake = self.fake_embedder()
        with patch.object(embeddings, "_create_embedder", return_value=fake) as loader:
            result = embeddings.embed_texts(["a", "b", "a"])
            result[0][0] = -100
            self.assertEqual(embeddings.embed_texts(["a"])[0][0], .6)
            embeddings.embed_texts(["changed biography"])
        self.assertEqual(fake.embed.call_args_list[0].args[0], ["a", "b"])
        self.assertEqual(fake.embed.call_args_list[1].args[0], ["changed biography"])
        self.assertEqual(fake.embed.call_count, 2)
        loader.assert_called_once()

    def test_lru_eviction_and_updated_model_generation_invalidate_cache(self):
        fake = self.fake_embedder()
        with patch.object(embeddings, "_create_embedder", return_value=fake) as loader:
            embeddings.embed_texts(["a", "b", "c"])
            embeddings.embed_texts(["a"])
            embeddings.embed_texts(["d"])
            embeddings.embed_texts(["b"])
            self.assertEqual(fake.embed.call_count, 3)
            (self.directory / "config.json").write_text("updated-test-config", encoding="utf-8")
            self.write_manifest()
            embeddings.embed_texts(["b"])
        self.assertEqual(loader.call_count, 2)
        self.assertEqual(fake.embed.call_count, 4)

    def test_manifest_detects_missing_assets_tampering_and_wrong_revision(self):
        with patch.object(embeddings, "_create_embedder") as loader:
            (self.directory / "config.json").write_text("tampered", encoding="utf-8")
            self.unavailable("model_invalid")
            self.write_model()
            manifest = embeddings.model_manifest(self.directory)
            manifest["revision"] = "main"
            (self.directory / embeddings.MANIFEST_NAME).write_text(json.dumps(manifest), encoding="utf-8")
            self.unavailable("model_invalid")
            (self.directory / "tokenizer.json").unlink()
            self.unavailable("model_missing")
        loader.assert_not_called()

    def test_invalid_vectors_fail_whole_batch_without_caching_a_valid_prefix(self):
        for invalid in [vector(0, 0), vector(float("nan")), vector(float("inf")), [1, 2]]:
            with self.subTest(kind=repr(invalid[:2])):
                embeddings.reset_embedding_state()
                fake = SimpleNamespace(embed=Mock(side_effect=[[vector(), invalid], [vector(), vector()]]))
                with patch.object(embeddings, "_create_embedder", return_value=fake):
                    self.unavailable("invalid_output", ["a", "b"])
                    embeddings.embed_texts(["a", "b"])
                self.assertEqual(fake.embed.call_count, 2)
                self.assertEqual(fake.embed.call_args_list[1].args[0], ["a", "b"])
        with patch.object(embeddings, "_create_embedder", return_value=SimpleNamespace(embed=lambda *args, **kwargs: [])):
            embeddings.reset_embedding_state()
            self.unavailable("invalid_output")

    def test_failure_does_not_expose_input_text_or_dependency_error(self):
        fake = SimpleNamespace(embed=Mock(side_effect=RuntimeError("private user text and provider internals")))
        with patch.object(embeddings, "_create_embedder", return_value=fake):
            self.unavailable("inference_failed", ["private user text"])

    def test_timeout_keeps_one_busy_job_without_queue_and_reuses_finished_work(self):
        started, release, done = threading.Event(), threading.Event(), threading.Event()

        def slow(texts, **kwargs):
            started.set()
            release.wait(2)
            done.set()
            return [vector() for _ in texts]

        fake = SimpleNamespace(embed=Mock(side_effect=slow))
        try:
            with override_settings(MATCHING_AI_TIMEOUT=.03), patch.object(embeddings, "_create_embedder", return_value=fake):
                self.unavailable("timeout")
                self.assertTrue(started.is_set())
                self.unavailable("busy", ["another request"])
                self.assertEqual(fake.embed.call_count, 1)
                release.set()
                self.assertTrue(done.wait(1))
                # Wait for the future's cache commit, not an arbitrary long delay.
                embeddings._job.result(timeout=1)
                embeddings.embed_texts(["volunteer"])
                self.assertEqual(fake.embed.call_count, 1)
        finally:
            release.set()
            if embeddings._job is not None:
                embeddings._job.result(timeout=2)


class PrepareModelTests(SimpleTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="v-connect-prepare-")
        self.parent = Path(self.temporary.name)
        self.directory = self.parent / "matching"
        self.override = override_settings(MATCHING_AI_MODEL=embeddings.MODEL_NAME,
            MATCHING_AI_MODEL_DIR=self.directory, MATCHING_AI_THREADS=2)
        self.override.enable()
        self.addCleanup(self.temporary.cleanup)
        self.addCleanup(self.override.disable)

    def write_assets(self, directory):
        for name in embeddings.MODEL_FILES:
            (directory / name).write_text("downloaded-pinned-asset", encoding="utf-8")

    def run_prepare(self, **kwargs):
        output = io.StringIO()
        call_command(prepare.Command(), stdout=output, **kwargs)
        return output.getvalue()

    def test_explicit_download_uses_pinned_public_revision_only(self):
        with patch("huggingface_hub.hf_hub_download") as download:
            prepare._download_assets(self.directory)
        self.assertEqual(download.call_count, len(embeddings.MODEL_FILES))
        for call in download.call_args_list:
            self.assertEqual(call.kwargs["repo_id"], embeddings.MODEL_REPOSITORY)
            self.assertEqual(call.kwargs["revision"], embeddings.MODEL_REVISION)
            self.assertIs(call.kwargs["token"], False)
            self.assertIs(call.kwargs["local_files_only"], False)

    def test_stages_self_tests_and_atomically_publishes_ready_manifest(self):
        def self_test(directory, threads):
            self.assertTrue(all((directory / name).exists() for name in embeddings.MODEL_FILES))
            self.assertFalse((directory / embeddings.MANIFEST_NAME).exists())
            self.assertFalse(self.directory.exists())
        with patch.object(prepare, "_download_assets", side_effect=self.write_assets), patch.object(prepare, "_self_test", side_effect=self_test):
            output = self.run_prepare()
        self.assertIn("384 dimensions, CPU", output)
        self.assertEqual(embeddings.validate_local_model(self.directory)["revision"], embeddings.MODEL_REVISION)
        self.assertEqual(list(self.parent.iterdir()), [self.directory])

    def test_existing_valid_model_self_tests_without_download(self):
        self.directory.mkdir()
        self.write_assets(self.directory)
        (self.directory / embeddings.MANIFEST_NAME).write_text(json.dumps(embeddings.model_manifest(self.directory)))
        with patch.object(prepare, "_download_assets") as download, patch.object(prepare, "_self_test") as self_test:
            self.run_prepare()
        download.assert_not_called()
        self_test.assert_called_once_with(self.directory, 2)

    def test_failed_download_or_self_test_preserves_previous_model(self):
        self.directory.mkdir()
        marker = self.directory / "previous"
        marker.write_text("preserve me")
        (self.directory / "model_optimized.onnx").write_text("previous model")
        for failure in [RuntimeError("network details"), embeddings.EmbeddingUnavailable("invalid_output")]:
            with self.subTest(failure=type(failure).__name__), patch.object(prepare, "_download_assets", side_effect=self.write_assets), patch.object(prepare, "_self_test", side_effect=failure):
                with self.assertRaises(CommandError):
                    self.run_prepare(force=True)
                self.assertEqual(marker.read_text(), "preserve me")
                self.assertEqual(list(self.parent.iterdir()), [self.directory])

    def test_force_preserves_old_folder_as_backup_after_success(self):
        self.directory.mkdir()
        (self.directory / "previous").write_text("backup")
        (self.directory / "model_optimized.onnx").write_text("previous model")
        with patch.object(prepare, "_download_assets", side_effect=self.write_assets), patch.object(prepare, "_self_test"):
            output = self.run_prepare(force=True)
        self.assertIn("Previous files preserved", output)
        backups = list(self.parent.glob(".matching.backup-*"))
        self.assertEqual(len(backups), 1)
        self.assertEqual((backups[0] / "previous").read_text(), "backup")
        embeddings.validate_local_model(self.directory)

    def test_another_preparation_is_not_overwritten(self):
        lock = self.parent / ".matching.prepare.lock"
        lock.write_text("existing-process")
        with patch.object(prepare, "_download_assets") as download:
            with self.assertRaisesMessage(CommandError, "Another model preparation"):
                self.run_prepare()
        download.assert_not_called()
        self.assertEqual(lock.read_text(), "existing-process")

    def test_misconfigured_existing_nonmodel_directory_is_never_moved(self):
        self.directory.mkdir()
        marker = self.directory / "unrelated-data"
        marker.write_text("preserve me")
        with patch.object(prepare, "_download_assets") as download:
            with self.assertRaisesMessage(CommandError, "contains unrelated files"):
                self.run_prepare(force=True)
        download.assert_not_called()
        self.assertEqual(marker.read_text(), "preserve me")
        self.assertEqual(list(self.parent.iterdir()), [self.directory])

    def test_staging_cleanup_rejects_a_model_or_external_path(self):
        self.directory.mkdir()
        with self.assertRaises(CommandError):
            prepare._remove_staging(self.directory, self.parent)
        self.assertTrue(self.directory.exists())

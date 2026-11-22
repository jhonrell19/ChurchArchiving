"""Offline recovery validation; no Supabase credentials or live storage needed."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/recover_private_uploads.py"
spec = importlib.util.spec_from_file_location("recover_private_uploads", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RecoveryPathTests(unittest.TestCase):
    def test_legacy_windows_upload_path_is_canonical(self):
        self.assertEqual(
            module.logical_path(r"uploads\baptismal\fictional.pdf"),
            "uploads/baptismal/fictional.pdf",
        )

    def test_external_links_and_traversal_rejected(self):
        for path in (
            "https://youtu.be/AbCdEfGh123",
            "C:\\users\\someone\\secret.pdf",
            "../uploads/baptismal/test.png",
            "uploads/../../secret.txt",
            "uploads/category/../secret.pdf",
            "uploads//category/secret.pdf",
            None,
        ):
            with self.subTest(path=path):
                self.assertIsNone(module.logical_path(path))

    def test_locate_file_without_disclosing_filename(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root)
            (directory / "baptismal").mkdir()
            path = directory / "baptismal" / "fixture.png"
            path.write_bytes(b"fictional scan data")
            self.assertEqual(
                module.resolve_candidate("uploads/baptismal/fixture.png", [directory]),
                path,
            )
            self.assertIsNone(
                module.resolve_candidate("uploads/baptismal/missing.png", [directory])
            )

    def test_two_conflicting_copies_refused(self):
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            roots = [Path(one), Path(two)]
            for root, text in zip(roots, [b"test 1", b"test 2"]):
                (root / "masses").mkdir()
                (root / "masses" / "fixture.mp4").write_bytes(text)
            with self.assertRaises(ValueError):
                module.resolve_candidate("uploads/masses/fixture.mp4", roots)


if __name__ == "__main__":
    unittest.main()

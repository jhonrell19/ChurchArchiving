from pathlib import Path
import tempfile
import unittest

from scripts.verify_upload_backup import verify


class VerifyBackupTests(unittest.TestCase):
    def test_compare_snapshots(self):
        with tempfile.TemporaryDirectory() as directory:
            source, restored = (Path(directory) / name for name in ("source", "restore"))
            source.mkdir()
            restored.mkdir()
            with self.assertRaises(ValueError):
                verify(source, restored)
            for root in (source, restored):
                (root / "archive").mkdir()
                (root / "archive" / "sample").write_bytes(b"abc")
            self.assertEqual(verify(source, restored)["matched"], 1)
            (restored / "archive" / "sample").write_bytes(b"xyz")
            (source / "missing").touch()
            (restored / "extra").touch()
            self.assertEqual(dict(verify(source, restored)), {"different": 1, "missing": 1, "extra": 1})
            with self.assertRaises(ValueError):
                verify(source, source)
            with self.assertRaises(ValueError):
                verify(source, source / "archive")

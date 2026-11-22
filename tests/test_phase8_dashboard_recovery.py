"""Dashboard recovery tests with fictional files, no network or real parish data."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location(
    "recover_via_supabase_dashboard", SCRIPTS / "recover_via_supabase_dashboard.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Conn:
    def __init__(self, found=True, size=7):
        self.found = found
        self.size = size
        self.operations = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.operations.append(sql)
        if "FROM storage.buckets" in sql:
            result = (False,)
        elif "FROM storage.objects" in sql:
            result = ({"size": self.size},) if self.found else None
        else:
            raise AssertionError("Unexpected database query")
        return SimpleNamespace(fetchone=lambda: result)


class DashboardRecoveryTests(unittest.TestCase):
    def test_prepares_hashed_objects_without_database_writes(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            source = root / "source"
            (source / "baptismal").mkdir(parents=True)
            (source / "baptismal" / "fictional.png").write_bytes(b"fakepng")
            args = SimpleNamespace(source=[source], output=root / "out",
                                   bucket="smart-parish-private", include_mass=False)
            with patch.object(mod, "pg_connection", return_value=Conn()), patch.object(
                mod, "candidates",
                return_value=[
                    ("uploads/baptismal/fictional.png", "archive"),
                    ("uploads/masses/missing.mp4", "mass"),
                ],
            ):
                self.assertEqual(mod.prepare(args), 0)
            manifest = json.loads((root / "out" / "recovery_manifest.json").read_text())
            self.assertEqual(len(manifest["files"]), 1)
            self.assertEqual(
                (root / "out" / "parish" / manifest["files"][0]["sha256"]).read_bytes(),
                b"fakepng",
            )

    def test_index_preview_requires_matching_remote_size_and_does_not_write(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "parish").mkdir()
            source = root / "parish" / "placeholder"
            source.write_bytes(b"fakepng")
            digest = mod.sha256(source)
            source.rename(root / "parish" / digest)
            (root / "recovery_manifest.json").write_text(json.dumps(
                {"version": 1, "bucket": "smart-parish-private", "files": [
                    {"path": "uploads/baptismal/fictional.png", "sha256": digest, "size": 7},
                ]}
            ))
            args = SimpleNamespace(output=root, confirm_bucket="smart-parish-private",
                                   apply=False, ack=None)
            db = Conn(size=7)
            with patch.object(mod, "pg_connection", return_value=db):
                self.assertEqual(mod.index(args), 0)
            self.assertEqual(len(db.operations), 2)
            with patch.object(mod, "pg_connection", return_value=Conn(found=False)):
                with self.assertRaises(ValueError):
                    mod.index(args)


if __name__ == "__main__":
    unittest.main()

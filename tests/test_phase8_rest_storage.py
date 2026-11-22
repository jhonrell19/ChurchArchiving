"""Supabase REST storage adapter tests: fictional data, no network or secrets."""
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "church_backend/private_uploads.py"
class FakeDB:
    pass
original = sys.modules.get("models")
sys.modules["models"] = SimpleNamespace(db=FakeDB())
try:
    spec = importlib.util.spec_from_file_location("phase8_private_uploads_test", SCRIPT)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
finally:
    if original is None:
        sys.modules.pop("models", None)
    else:
        sys.modules["models"] = original


class Download:
    status_code = 200
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def iter_content(self, chunk_size=None):
        return [self.payload]


class RESTStorageTests(unittest.TestCase):
    def setUp(self):
        self.patch = patch.dict(os.environ, {
            "PARISH_STORAGE_PROVIDER": "supabase_rest",
            "PARISH_SUPABASE_URL": "https://fictional.supabase.co",
            "PARISH_SUPABASE_SERVICE_ROLE_KEY": "a"*48,
        })
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_bad_website_is_rejected(self):
        for base in ("http://fictional.supabase.co", "https://malicious.test", "https://fictional.supabase.co.evil.test"):
            with patch.dict(os.environ, {"PARISH_SUPABASE_URL": base}):
                with self.assertRaises(RuntimeError):
                    m._rest_credentials()

    def test_verified_upload_and_existing_digest_reuse(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "fictional.png"
            p.write_bytes(b"fictional")
            digest = m.file_digest(p)
            with patch.object(m.requests, "post", return_value=SimpleNamespace(status_code=201)) as post, patch.object(
                m.requests, "get", return_value=Download(b"fictional")
            ):
                m._rest_upload("smart-parish-private", "parish/"+digest, p, digest)
                self.assertIn("/storage/v1/object/smart-parish-private/parish/", post.call_args.args[0])
            with patch.object(m.requests, "post", return_value=SimpleNamespace(status_code=409)), patch.object(
                m.requests, "get", return_value=Download(b"fictional")
            ):
                m._rest_upload("smart-parish-private", "parish/"+digest, p, digest)

    def test_wrong_remote_bytes_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "fictional.pdf"
            p.write_bytes(b"real-document-test")
            with patch.object(m.requests, "post", return_value=SimpleNamespace(status_code=201)), patch.object(
                m.requests, "get", return_value=Download(b"wrong")
            ):
                with self.assertRaises(RuntimeError):
                    m._rest_upload("smart-parish-private", "parish/"+m.file_digest(p), p, m.file_digest(p))

    def test_signing_is_short_lived_and_host_bound(self):
        with patch.object(m.requests, "post", return_value=SimpleNamespace(
            status_code=200, json=lambda: {"signedURL": "/object/sign/smart-parish-private/parish/abc?token=fake"}
        )):
            result = m._rest_signed_url("smart-parish-private", "parish/abc", 60)
            self.assertTrue(result.startswith("https://fictional.supabase.co/storage/v1/object/sign/"))
        with patch.object(m.requests, "post", return_value=SimpleNamespace(
            status_code=200, json=lambda: {"signedURL": "https://evil.test/secret"}
        )):
            with self.assertRaises(RuntimeError):
                m._rest_signed_url("smart-parish-private", "parish/abc", 60)


if __name__ == "__main__":
    unittest.main()

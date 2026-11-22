"""Exercise video-link validation in the actual Flask handler without a database."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

SERVER = Path(__file__).resolve().parents[1] / "church_backend/server.py"


class MassVideoLinkTests(unittest.TestCase):
    def setUp(self):
        self.fields = {
            "title": "Fictional Sunday Mass", "priest": "Test Minister",
            "category": "High Mass", "date": "2026-11-22", "duration": "10m", "status": "Pending",
            "videoUrl": "https://youtu.be/AbCdEfGh123",
        }
        self.db = Mock()
        self.created = []
        class Mass:
            def __init__(inner, **kwargs):
                self.created.append(inner)
                for key, value in kwargs.items():
                    setattr(inner, key, value)
                inner.id = 1
        namespace = {
            "require_roles": lambda *_: None,
            "request": SimpleNamespace(form=self.fields, files={"file": None}),
            "db": self.db,
            "MassRecord": Mass,
            "AuditLog": lambda **kwargs: kwargs,
            "os": __import__("os"),
            "re": __import__("re"),
            "g": SimpleNamespace(user_email="staff@example.test"),
        }
        tree = ast.parse(SERVER.read_text(encoding="utf-8"))
        fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "api_create_mass")
        fn.decorator_list = []
        exec(compile(ast.Module([fn], type_ignores=[]), str(SERVER), "exec"), namespace)
        self.create = namespace["api_create_mass"]

    def test_link_is_canonical_and_stored_in_existing_field(self):
        result, status = self.create()
        self.assertEqual(status, 201)
        self.assertEqual(result["mass"]["filepath"], "https://www.youtube.com/watch?v=AbCdEfGh123")
        self.assertEqual(self.created[0].filepath, result["mass"]["filepath"])
        self.db.session.commit.assert_called()

    def test_arbitrary_public_media_hosts_are_rejected(self):
        for link in [
            "https://example.test/watch?v=AbCdEfGh123",
            "http://www.youtube.com/watch?v=AbCdEfGh123",
            "https://www.youtube.com/watch?v=BAD",
            "https://www.youtube.com.evil.test/watch?v=AbCdEfGh123",
        ]:
            with self.subTest(link=link):
                self.fields["videoUrl"] = link
                self.assertEqual(self.create()[1], 400)
        self.db.session.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()

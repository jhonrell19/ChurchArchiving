"""Use the deployed handler and its role check without importing a database-bound app."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[1] / "church_backend" / "server.py"


class WebTranscriptionTests(unittest.TestCase):
    def setUp(self):
        self.context = SimpleNamespace()
        scope = {"g": self.context}
        tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name in {"require_roles", "api_transcribe_mass_ai"}:
                node.decorator_list = []
                exec(compile(ast.Module([node], []), str(SOURCE), "exec"), scope)
        self.transcribe = scope["api_transcribe_mass_ai"]

    def test_admin_gets_pause_even_with_old_override(self):
        self.context.user_role = "ADMIN"
        with patch.dict("os.environ", {"SMART_PARISH_ALLOW_INPROCESS_AI": "YES"}):
            body, status = self.transcribe(1)
        self.assertEqual(status, 503)
        self.assertIn("paused", body["error"])

    def test_other_roles_are_denied(self):
        for role in ("USER", "BURIAL_ADMIN"):
            with self.subTest(role=role):
                self.context.user_role = role
                self.assertEqual(self.transcribe(1)[1], 403)

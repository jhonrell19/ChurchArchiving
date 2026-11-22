"""Isolated security regressions; no network, credentials, or live database."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

SERVER = Path(__file__).resolve().parents[1] / "church_backend/server.py"


def load_function(name, scope):
    tree = ast.parse(SERVER.read_text(encoding="utf-8"))
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    node.decorator_list = []
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), "exec"), scope)
    return scope[name]


def status(result):
    return result[1] if isinstance(result, tuple) else 200


class CertificateOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.record = SimpleNamespace(
            id=42, requester_user_id=7, sacrament_type="baptismal",
            status="Released", payment_status="Paid", payment_method="CASH",
            generated_file="uploads/releases/request_42/fictional.pdf",
        )
        self.db = Mock()
        self.db.session.get.return_value = self.record
        self.role = "USER"
        self.actor_id = 7
        self.read_file = Mock(return_value="C:/fixture/fictional.pdf")
        self.send_file = Mock(return_value={"ok": True})
        self.scope = {
            "db": self.db,
            "CertificateRequest": object,
            "g": SimpleNamespace(user_role="USER"),
            "current_user_id": lambda: self.actor_id,
            "staff_can_access_request": lambda request: (
                self.scope["g"].user_role == "ADMIN" and request.sacrament_type in
                {"baptismal", "confirmation", "marriage"}
            ) or (
                self.scope["g"].user_role == "BURIAL_ADMIN" and request.sacrament_type in
                {"ownership", "land_agreement", "burial"}
            ),
            "_payment_is_test_only": lambda request: request.payment_method == "DEMO",
            "normalize_path": lambda path: path,
            "readable_upload": self.read_file,
            "os": SimpleNamespace(path=SimpleNamespace(isfile=lambda path: True,
                                     dirname=lambda path: "C:/fixture",
                                     basename=lambda path: "fictional.pdf")),
            "posixpath": __import__("posixpath"),
            "send_from_directory": self.send_file,
        }
        self.download = load_function("api_download_request_document", self.scope)

    def test_second_parishioner_cannot_download_by_request_id(self):
        self.actor_id = 8
        self.assertEqual(status(self.download(42)), 403)
        self.read_file.assert_not_called()

    def test_no_download_before_payment_or_release(self):
        for state in [("Approved", "Paid"), ("Released", "Pending")]:
            with self.subTest(state=state):
                self.record.status, self.record.payment_status = state
                self.assertEqual(status(self.download(42)), 403)
        self.read_file.assert_not_called()

    def test_demo_payment_does_not_authorize_certificate(self):
        self.record.payment_method = "DEMO"
        self.assertEqual(status(self.download(42)), 403)

    def test_owner_can_download_paid_released_file(self):
        self.assertEqual(status(self.download(42)), 200)
        self.send_file.assert_called_once()

    def test_wrong_office_cannot_download(self):
        self.scope["g"].user_role = "BURIAL_ADMIN"
        self.assertEqual(status(self.download(42)), 403)
        self.read_file.assert_not_called()

    def test_direct_scan_url_is_forbidden_to_parishioner(self):
        scope = {
            "can_access_filepath": lambda _: False,
            "readable_upload": Mock(),
            "send_from_directory": Mock(),
        }
        view = load_function("view_file", scope)
        self.assertEqual(status(view("uploads/baptismal/private-scan.pdf")), 403)
        scope["readable_upload"].assert_not_called()

    def test_archive_original_scan_endpoint_rejects_parishioner(self):
        scope = {
            "require_roles": lambda *_: ({"error": "Forbidden"}, 403),
            "db": Mock(),
        }
        view = load_function("api_archive_original_scan", scope)
        self.assertEqual(status(view(12)), 403)
        scope["db"].session.get.assert_not_called()


if __name__ == "__main__":
    unittest.main()

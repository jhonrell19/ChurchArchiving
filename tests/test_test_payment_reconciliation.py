"""Offline proof: a TEST-only Paid request can become Unpaid, not Released.

The original PayMongo test ledger is never removed. No real money, Supabase
instance, live API, or SMS gateway is accessed.
"""
import ast
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

SERVER = Path(__file__).resolve().parents[1] / "church_backend/server.py"


class SandboxPaymentReconciliationTest(unittest.TestCase):
    def setUp(self):
        self.cert = SimpleNamespace(
            id=42, requester_user_id=7, sacrament_type="baptismal",
            status="Ready", payment_status="Paid",
            payment_method="PAYMONGO_TEST", payment_reference="cs_test_fixture_only",
            paid_at=datetime.utcnow(), matched_document_id=3,
            remarks="Final document prepared and ready for payment."
        )
        self.payload = {
            "acknowledgement": "NO_REAL_FUNDS_RECEIVED",
            "reason": "This was a PayMongo sandbox demonstration with no real money."
        }
        self.allowed = True
        self.audit = []
        self.query = Mock()
        self.query.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = self.cert
        self.session = Mock()
        scope = {
            "require_roles": lambda *_: None,
            "request": SimpleNamespace(get_json=lambda silent=True: self.payload),
            "CertificateRequest": SimpleNamespace(query=self.query),
            "db": SimpleNamespace(session=self.session),
            "g": SimpleNamespace(user_role="STAFF", user_id="21", user_email="staff@example.test"),
            "current_user_id": lambda: 21,
            "staff_can_access_request": lambda _: self.allowed,
            "AuditLog": lambda **kwargs: self.audit.append(kwargs) or kwargs,
            "app": SimpleNamespace(logger=Mock()),
        }
        node = next(node for node in ast.parse(SERVER.read_text(encoding="utf-8")).body
                    if isinstance(node, ast.FunctionDef) and
                    node.name == "api_reconcile_test_payment")
        node.decorator_list = []
        exec(compile(ast.Module([node], type_ignores=[]), str(SERVER), "exec"), scope)
        self.handler = scope["api_reconcile_test_payment"]

    def test_sandbox_correction_preserves_request_and_audit(self):
        previous = self.cert.payment_reference
        response, status = self.handler(42)
        self.assertEqual(status, 200)
        self.assertTrue(response["ok"])
        self.assertEqual(self.cert.status, "Ready")
        self.assertEqual(self.cert.payment_status, "Unpaid")
        self.assertEqual(self.cert.payment_method, "PAYMONGO_TEST_RECONCILED")
        self.assertIsNone(self.cert.payment_reference)
        self.assertIsNone(self.cert.paid_at)
        self.assertEqual(self.session.commit.call_count, 1)
        self.assertEqual(len(self.audit), 1)
        self.assertIn(previous, self.audit[0]["action"])
        self.assertLessEqual(len(self.audit[0]["action"]), 500)
        self.assertIn("no real money", self.cert.remarks)
        self.assertEqual(self.handler(42)[1], 409, "replay must not reconcile twice")
        self.assertEqual(self.session.commit.call_count, 1)

    def test_live_and_cash_payments_cannot_be_reconciled(self):
        for method in ["PAYMONGO_LIVE", "CASH", "PAYMONGO_TEST_PENDING"]:
            with self.subTest(method=method):
                self.cert.payment_status = "Paid"
                self.cert.payment_method = method
                self.assertEqual(self.handler(42)[1], 409)
        self.assertFalse(self.audit)
        self.session.commit.assert_not_called()

    def test_request_owner_and_release_are_enforced(self):
        self.allowed = False
        self.assertEqual(self.handler(42)[1], 403)
        self.allowed = True
        self.cert.status = "Released"
        self.assertEqual(self.handler(42)[1], 409)
        self.session.commit.assert_not_called()

    def test_explicit_confirmation_and_reason_required(self):
        self.payload["acknowledgement"] = "YES"
        self.assertEqual(self.handler(42)[1], 400)
        self.payload["acknowledgement"] = "NO_REAL_FUNDS_RECEIVED"
        self.payload["reason"] = "test"
        self.assertEqual(self.handler(42)[1], 400)
        self.session.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()

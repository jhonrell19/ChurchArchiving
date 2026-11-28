"""Offline checkout contract checks: ZERO real PayMongo or DB traffic.

These tests execute only the Flask certificate_checkout function in an isolated
namespace with mocked request, PayMongo response and DB transaction. They do
NOT simulate provider-side Authorize and do NOT prove external checkout works.
"""
import ast
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

SERVER = Path(__file__).resolve().parents[1] / "church_backend/server.py"


class PayMongoSandboxCheckoutTests(unittest.TestCase):
    def setUp(self):
        self.cert = SimpleNamespace(
            id=42, requester_user_id=7, status="Ready",
            payment_status="Unpaid", payment_method=None, payment_reference=None,
            total_fee=300, base_fee=300, urgent_fee=0,
            requester_email="parishioner@example.test",
            requester_name="Example Parishioner",
        )
        self.payload = {"expectedMode": "test"}
        self.mode = "test"
        self.provider_calls = []
        self.session = Mock()
        self.query = Mock()
        self.query.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = self.cert

        def call_provider(method, path, payload=None):
            self.provider_calls.append((method, path, payload))
            if method == "GET":
                return {"data": {"attributes": {
                    "status": "active",
                    "livemode": False,
                    "payments": [],
                    "checkout_url": "https://checkout.paymongo.com/existing-sandbox",
                }}}
            return {"data": {
                "id": "cs_new_test_fixture",
                "attributes": {
                    "livemode": self.mode == "live",
                    "checkout_url": "https://checkout.paymongo.com/new-sandbox",
                },
            }}

        scope = {
            "require_roles": lambda *_: None,
            "request": SimpleNamespace(get_json=lambda silent=True: self.payload),
            "CertificateRequest": SimpleNamespace(query=self.query),
            "current_user_id": lambda: 7,
            "db": SimpleNamespace(session=self.session),
            "_paymongo_mode": lambda: (self.mode, "sk_test_fixture_secret"),
            "_paymongo_api": call_provider,
            "os": os,
            "app": SimpleNamespace(logger=Mock()),
        }
        node = next(
            node for node in ast.parse(SERVER.read_text(encoding="utf-8")).body
            if isinstance(node, ast.FunctionDef) and node.name == "certificate_checkout"
        )
        node.decorator_list = []
        exec(compile(ast.Module([node], type_ignores=[]), str(SERVER), "exec"), scope)
        self.checkout = scope["certificate_checkout"]

    def test_sandbox_checkout_creates_provider_test_pending_only(self):
        with patch.dict(os.environ, {
            "APP_BASE_URL": "https://example.test",
            "PAYMONGO_METHODS": "qrph",
        }):
            response, code = self.checkout(42)
        self.assertEqual(code, 200)
        self.assertTrue(response["checkoutUrl"].startswith("https://checkout.paymongo.com/"))
        self.assertEqual(self.cert.payment_method, "PAYMONGO_TEST_PENDING")
        self.assertEqual(self.cert.payment_status, "Unpaid")
        self.assertEqual(self.cert.status, "Ready")
        self.assertEqual(self.cert.payment_reference, "cs_new_test_fixture")
        self.assertEqual(self.session.commit.call_count, 1)
        self.assertEqual(len(self.provider_calls), 1)
        self.assertEqual(self.provider_calls[0][0], "POST")
        self.assertEqual(self.provider_calls[0][2]["data"]["attributes"]["payment_method_types"], ["qrph"])

    def test_sandbox_button_cannot_start_live_checkout_after_mode_flip(self):
        self.mode = "live"
        with patch.dict(os.environ, {"APP_BASE_URL": "https://example.test", "PAYMONGO_METHODS": "qrph"}):
            response, code = self.checkout(42)
        self.assertEqual(code, 409)
        self.assertIn("Payment mode changed", response["error"])
        self.assertEqual(self.provider_calls, [])
        self.session.commit.assert_not_called()
        self.assertIsNone(self.cert.payment_reference)

    def test_mode_is_explicit_even_if_page_is_stale(self):
        self.payload = {}
        with patch.dict(os.environ, {"APP_BASE_URL": "https://example.test", "PAYMONGO_METHODS": "qrph"}):
            response, code = self.checkout(42)
        self.assertEqual(code, 409)
        self.assertIn("Refresh the page", response["error"])
        self.assertFalse(self.provider_calls)

    def test_pending_checkout_reuses_active_session_not_duplicate(self):
        self.cert.payment_reference = "cs_existing_session"
        self.cert.payment_method = "PAYMONGO_TEST_PENDING"
        with patch.dict(os.environ, {"APP_BASE_URL": "https://example.test", "PAYMONGO_METHODS": "qrph"}):
            response = self.checkout(42)
        self.assertEqual(response["checkoutUrl"], "https://checkout.paymongo.com/existing-sandbox")
        self.assertEqual([call[0] for call in self.provider_calls], ["GET"])
        self.session.commit.assert_not_called()
        self.assertEqual(self.cert.payment_status, "Unpaid")

    def test_paid_request_never_creates_another_checkout(self):
        self.cert.payment_status = "Paid"
        response, code = self.checkout(42)
        self.assertEqual(code, 409)
        self.assertEqual(response["error"], "Already paid")
        self.assertFalse(self.provider_calls)


if __name__ == "__main__":
    unittest.main()

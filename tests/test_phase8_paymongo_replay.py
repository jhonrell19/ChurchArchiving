"""Real Flask PayMongo-confirm handler, isolated from all network and databases."""
import ast
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

SERVER = Path(__file__).resolve().parents[1] / "church_backend/server.py"


def isolate(name, namespace):
    tree = ast.parse(SERVER.read_text(encoding="utf-8"))
    target = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
    target.decorator_list = []
    exec(compile(ast.Module([target], type_ignores=[]), str(SERVER), "exec"), namespace)
    return namespace[name]


class PaymentReplayTests(unittest.TestCase):
    def setUp(self):
        self.cert = SimpleNamespace(
            id=42, matched_document_id=5, payment_reference="cs_fixture",
            payment_status="Pending", payment_method=None, status="Approved",
            base_fee=100, urgent_fee=0, total_fee=100, paid_at=None,
        )
        self.matches = [self.cert]
        self.query = Mock()
        self.query.filter_by.return_value.with_for_update.return_value.limit.return_value.all.side_effect = lambda: self.matches
        self.ledger = {}
        self.db = SimpleNamespace(session=Mock())
        self.db.session.execute.side_effect = self.execute
        self.actual = {
            "livemode": False, "reference_number": "PARISH-CERT-42",
            "payments": [{"id": "pay_fixture_1", "attributes": {
                "status": "paid", "amount": 10000, "currency": "PHP"
            }}],
        }
        self.namespace = {
            "request": SimpleNamespace(
                headers={"X-User-Role": "PAYMONGO_WEBHOOK"},
                get_json=lambda silent=True: {"checkoutSessionId": "cs_fixture", "mode": "test"},
            ),
            "CertificateRequest": SimpleNamespace(query=self.query),
            "db": self.db,
            "text": lambda sql: sql,
            "re": __import__("re"),
            "datetime": datetime,
            "AuditLog": lambda **kwargs: kwargs,
            "_paymongo_mode": lambda: ("test", "mock"),
            "_paymongo_api": lambda method, path: {"data": {"attributes": self.actual}},
            "app": SimpleNamespace(logger=Mock()),
        }
        self.confirm = isolate("paymongo_confirm_internal", self.namespace)

    def execute(self, statement, params):
        if statement.startswith("SELECT"):
            record = self.ledger.get(params["pid"])
            return SimpleNamespace(fetchone=lambda: record)
        if statement.startswith("INSERT"):
            self.ledger[params["pid"]] = (
                params["rid"], params["sid"], params["amount"], params["live"]
            )
            return SimpleNamespace()
        raise AssertionError("Unknown SQL in isolated test")

    def test_identical_provider_event_is_idempotent(self):
        self.assertEqual(self.confirm()[1], 200)
        self.assertEqual(len(self.ledger), 1)
        self.assertEqual(self.cert.payment_status, "Paid")
        self.assertEqual(self.confirm()[1], 200)
        self.assertEqual(len(self.ledger), 1)
        self.assertEqual(self.db.session.commit.call_count, 1)

    def test_checkout_reference_shared_by_two_requests_is_rejected(self):
        self.matches = [self.cert, SimpleNamespace(id=99)]
        self.assertEqual(self.confirm()[1], 409)
        self.assertEqual(self.ledger, {})

    def test_wrong_paid_amount_is_not_credited(self):
        self.actual["payments"][0]["attributes"]["amount"] = 9999
        self.assertEqual(self.confirm()[1], 409)
        self.assertEqual(self.cert.payment_status, "Pending")
        self.assertEqual(self.ledger, {})

    def test_wrong_payment_reference_is_not_credited(self):
        self.actual["reference_number"] = "PARISH-CERT-OTHER"
        self.assertEqual(self.confirm()[1], 409)
        self.assertEqual(self.ledger, {})

    def test_existing_payment_id_cannot_fund_another_request(self):
        self.ledger["pay_fixture_1"] = (999, "cs_other", 10000, 0)
        self.assertEqual(self.confirm()[1], 409)
        self.assertEqual(self.cert.payment_status, "Pending")

    def test_spoofed_role_rejected(self):
        self.namespace["request"].headers["X-User-Role"] = "USER"
        self.assertEqual(self.confirm()[1], 403)


if __name__ == "__main__":
    unittest.main()

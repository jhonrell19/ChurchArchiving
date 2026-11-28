"""Cash ledger isolated tests: no real users, payments or database writes."""
import ast
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

SERVER = Path(__file__).resolve().parents[1] / "church_backend/server.py"


class CashReceiptsTest(unittest.TestCase):
    def setUp(self):
        self.cert = SimpleNamespace(id=42, status="Approved", sacrament_type="baptismal",
                                    payment_status="Unpaid", payment_method=None,
                                    payment_reference=None, paid_at=None,
                                    total_fee=100, matched_document_id=3)
        self.rows = []
        self.request_data = {"action": "record", "receiptNumber": "E2E-CASH-00001",
                             "reason": "Fictional office cash collection"}
        self.query = Mock()
        self.query.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = self.cert
        self.session = Mock()
        self.session.execute.side_effect = self.execute
        self.errors = []
        scope = {
            "require_roles": lambda *_: None,
            "request": SimpleNamespace(get_json=lambda silent=True: self.request_data),
            "CertificateRequest": SimpleNamespace(query=self.query),
            "db": SimpleNamespace(session=self.session),
            "text": lambda sql: sql,
            "re": __import__("re"),
            "os": os,
            "g": SimpleNamespace(user_role="STAFF", user_id="101", user_email="fixture@example.test"),
            "current_user_id": lambda: 101,
            "staff_can_access_request": lambda _: True,
            "AuditLog": lambda **kw: kw,
            "datetime": __import__("datetime").datetime,
            "app": SimpleNamespace(logger=Mock()),
        }
        class IntegrityError(Exception):
            pass
        scope["IntegrityError"] = IntegrityError
        node = next(x for x in ast.parse(SERVER.read_text(encoding="utf-8")).body
                    if isinstance(x, ast.FunctionDef) and x.name == "api_record_cash_receipt")
        node.decorator_list = []
        exec(compile(ast.Module([node], type_ignores=[]), str(SERVER), "exec"), scope)
        self.handler = scope["api_record_cash_receipt"]

    def execute(self, query, parameters):
        statement = str(query).strip()
        if statement.startswith("INSERT INTO parish_private.cash_receipt_ledger"):
            self.rows.append(parameters.copy())
            return Mock()
        if statement.startswith("SELECT id,amount_cents FROM parish_private.cash_receipt_ledger"):
            return SimpleNamespace(first=lambda: SimpleNamespace(id=1, amount_cents=10000))
        self.errors.append(statement)
        raise AssertionError("Unexpected SQL in finance test")

    def test_record_then_reverse_are_separate_append_only_entries(self):
        with patch.dict(os.environ, {"PARISH_CASH_RECEIPTS": "enabled"}):
            self.assertEqual(self.handler(42)[1], 200)
            self.assertEqual(self.cert.payment_status, "Paid")
            self.assertEqual(self.rows[0]["amount"], 10000)
            self.assertEqual(self.rows[0]["role"], "STAFF")
            self.request_data.update(action="reverse", receiptNumber="REV-00000001",
                                     reason="Fictional administrative correction")
            self.assertEqual(self.handler(42)[1], 200)
        self.assertEqual(len(self.rows), 2)
        self.assertEqual(self.rows[1]["amount"], -10000)
        self.assertEqual(self.rows[1]["original"], 1)
        self.assertEqual(self.cert.payment_status, "Unpaid")
        self.assertEqual(self.errors, [])
        self.assertEqual(self.session.commit.call_count, 2)

    def test_cash_feature_requires_explicit_flag(self):
        with patch.dict(os.environ, {"PARISH_CASH_RECEIPTS": ""}):
            self.assertEqual(self.handler(42)[1], 503)
        self.assertFalse(self.rows)

    def test_cash_rejected_without_approved_request(self):
        self.cert.status = "Pending"
        with patch.dict(os.environ, {"PARISH_CASH_RECEIPTS": "enabled"}):
            self.assertEqual(self.handler(42)[1], 409)
        self.assertFalse(self.rows)

    def test_duplicate_cash_record_while_paid_is_rejected(self):
        self.cert.payment_status = "Paid"
        with patch.dict(os.environ, {"PARISH_CASH_RECEIPTS": "enabled"}):
            self.assertEqual(self.handler(42)[1], 409)
        self.assertFalse(self.rows)


if __name__ == "__main__":
    unittest.main()

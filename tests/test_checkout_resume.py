"""Exercise the checkout handler with the provider and record store substituted."""
import ast
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


class CheckoutResumeTest(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).resolve().parents[1] / 'church_backend/server.py'
        function = next(node for node in ast.parse(path.read_text()).body
                        if isinstance(node, ast.FunctionDef) and node.name == 'certificate_checkout')
        function.decorator_list = []
        self.cert = SimpleNamespace(requester_user_id=7, status='Approved', payment_status='Pending',
                                    payment_reference='cs_example', payment_method='PAYMONGO_TEST_PENDING')
        self.db = Mock()
        self.db.session.query.return_value.filter_by.return_value.with_for_update.return_value.one_or_none.return_value = self.cert
        self.provider = Mock()
        self.url = 'https://checkout.paymongo.com/example'
        self.prior = dict(status='active', livemode=False, checkout_url=self.url, payments=[])
        self.provider.return_value = {'data': {'attributes': self.prior}}
        scope = dict(require_roles=lambda *_: None, current_user_id=lambda: 7, db=self.db,
                     request=SimpleNamespace(get_json=lambda silent=True: {'expectedMode': 'test'}),
                     CertificateRequest=object, _paymongo_mode=lambda: ('test', 'fixture'),
                     _paymongo_api=self.provider, os=os)
        exec(compile(ast.Module([function], []), str(path), 'exec'), scope)
        self.checkout = scope['certificate_checkout']

    def test_resume_same_unpaid_session(self):
        self.assertEqual(self.checkout(1), {'checkoutUrl': self.url})
        self.provider.assert_called_once_with('GET', '/v1/checkout_sessions/cs_example')

    def test_paid_wrong_mode_and_untrusted_url_do_not_resume(self):
        for changes in [dict(payments=[{'attributes': {'status': 'paid'}}]), dict(livemode=True),
                        dict(checkout_url='https://example.invalid/')]:
            with self.subTest(changes=changes), patch.dict(self.prior, changes):
                self.assertEqual(self.checkout(1)[1], 409)

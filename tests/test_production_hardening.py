"""Offline regression checks only; never touch actual user databases."""
from pathlib import Path
import ast
import contextlib
import os
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

def payment_config():
    tree = ast.parse((ROOT / 'church_backend/server.py').read_text())
    node = next(x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name == '_paymongo_mode')
    scope = {'os': os}
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<isolate>', 'exec'), scope)
    return scope['_paymongo_mode']

@contextlib.contextmanager
def env(**values):
    original = {k: os.environ.get(k) for k in values}
    try:
        for k, v in values.items():
            if v is None: os.environ.pop(k, None)
            else: os.environ[k] = v
        yield
    finally:
        for k, v in original.items():
            if v is None: os.environ.pop(k, None)
            else: os.environ[k] = v

class PaymentConfigTests(unittest.TestCase):
    def test_test_mode(self):
        with env(PAYMONGO_MODE='test', PAYMONGO_SECRET_KEY='sk_test_fake'):
            self.assertEqual(payment_config()()[0], 'test')
    def test_reject_live_key_in_test_mode(self):
        with env(PAYMONGO_MODE='test', PAYMONGO_SECRET_KEY='sk_live_fake'):
            with self.assertRaises(ValueError): payment_config()()
    def test_reject_live_without_approval(self):
        with env(PAYMONGO_MODE='live', PAYMONGO_SECRET_KEY='sk_live_fake',
                 SMART_PARISH_ENV='production', PAYMONGO_LIVE_ENABLED='NO'):
            with self.assertRaises(ValueError): payment_config()()
    def test_reject_live_without_fee_approval(self):
        with env(PAYMONGO_MODE='live', PAYMONGO_SECRET_KEY='sk_live_fake',
                 SMART_PARISH_ENV='production', PAYMONGO_LIVE_ENABLED='YES', CERT_FEES_APPROVED='NO'):
            with self.assertRaises(ValueError): payment_config()()
    def test_reject_live_without_explicit_fees(self):
        with env(PAYMONGO_MODE='live', PAYMONGO_SECRET_KEY='sk_live_fake',
                 SMART_PARISH_ENV='production', PAYMONGO_LIVE_ENABLED='YES', CERT_FEES_APPROVED='YES',
                 APP_BASE_URL='https://parish.example.org', FLASK_DEBUG='0', CERT_FEE_BAPTISMAL=None):
            with self.assertRaises(ValueError): payment_config()()

class LedgerTests(unittest.TestCase):
    def test_additive_and_repeatable(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('ledger', ROOT/'scripts/migrate_payment_ledger.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as d:
            db = Path(d)/'archive.db'; backups = Path(d)/'backups'
            with contextlib.closing(sqlite3.connect(db)) as conn, conn:
                conn.execute('CREATE TABLE certificate_request (id INTEGER PRIMARY KEY, status TEXT)')
                conn.execute("INSERT INTO certificate_request VALUES (42,'Approved')")
            module.migrate(db, False, backups)
            with contextlib.closing(sqlite3.connect(db)) as conn, conn:
                self.assertFalse(conn.execute("SELECT name FROM sqlite_master WHERE name='paymongo_verified_payment'").fetchone())
            module.migrate(db, True, backups);module.migrate(db, True, backups)
            with contextlib.closing(sqlite3.connect(db)) as conn, conn:
                self.assertEqual(conn.execute('SELECT status FROM certificate_request WHERE id=42').fetchone()[0], 'Approved')
                self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                conn.execute("INSERT INTO paymongo_verified_payment (provider_payment_id,checkout_session_id,request_id,amount_cents,currency,livemode) VALUES ('pay_1','cs_1',42,10000,'PHP',0)")
                with self.assertRaises(sqlite3.IntegrityError):
                    conn.execute("INSERT INTO paymongo_verified_payment (provider_payment_id,checkout_session_id,request_id,amount_cents,currency,livemode) VALUES ('pay_1','cs_2',42,10000,'PHP',0)")
            self.assertEqual(len(list(backups.glob('*.db'))), 1)

class SecurityTests(unittest.TestCase):
    def test_staff_provisioning_not_hardcoded(self):
        s=(ROOT/'scripts/create-staff-accounts.ts').read_text()
        self.assertNotIn("bcrypt.hash(\n      'Admin12345'",s)
        self.assertIn('STAFF_PASSWORD_ROTATION',s)
    def test_webhook_checks_modes_and_hmac(self):
        s=(ROOT/'src/app/api/paymongo/webhook/route.ts').read_text()
        for token in ['timingSafeEqual','components.li','components.te','event.livemode']:
            self.assertIn(token,s)
    def test_csrf_boundary(self):
        s=(ROOT/'src/proxy.ts').read_text()
        self.assertIn("pathname !== '/api/paymongo/webhook'",s)
        self.assertIn("'/api/:path*'",s)

if __name__=='__main__':unittest.main()

import pathlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing

ROOT = pathlib.Path(__file__).resolve().parents[1]

class AccountSecurityMigrationTests(unittest.TestCase):
    def test_additive_repeatable_and_old_staff_sessions_revoked(self):
        with tempfile.TemporaryDirectory() as td:
            d = pathlib.Path(td) / 'app'
            d.mkdir()
            db = d / 'dev.db'
            with closing(sqlite3.connect(db)) as conn:
                conn.execute('CREATE TABLE "User" (id INTEGER PRIMARY KEY, role TEXT NOT NULL, email TEXT NOT NULL)')
                conn.execute('CREATE TABLE "Session" (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, tokenHash TEXT)')
                conn.executemany('INSERT INTO "User" VALUES (?,?,?)', [(1,'ADMIN','admin@example.test'),(2,'USER','user@example.test')])
                conn.executemany('INSERT INTO "Session" VALUES (?,?,?)', [(1,1,'admin-token'),(2,2,'user-token')])
                conn.commit()
            tool = ROOT / 'scripts' / 'migrate_account_security.py'
            dry = subprocess.run([sys.executable, str(tool), '--db', str(db)], text=True, capture_output=True, check=True)
            self.assertIn('DRY RUN', dry.stdout)
            with closing(sqlite3.connect(db)) as conn:
                self.assertFalse(conn.execute("SELECT name FROM sqlite_master WHERE name='StaffMfa'").fetchone())
            installed = subprocess.run([sys.executable, str(tool), '--db', str(db), '--apply'], text=True, capture_output=True, check=True)
            self.assertIn('PASS', installed.stdout)
            with closing(sqlite3.connect(db)) as conn:
                tables = {x[0] for x in conn.execute('SELECT name FROM sqlite_master WHERE type="table"')}
                self.assertTrue({'StaffMfa','StaffMfaChallenge','PhoneVerification'}.issubset(tables))
                self.assertEqual(conn.execute('SELECT COUNT(*) FROM "User"').fetchone()[0], 2)
                self.assertEqual(conn.execute('SELECT tokenHash FROM "Session"').fetchone()[0], 'user-token')
                self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            again = subprocess.run([sys.executable, str(tool), '--db', str(db), '--apply'], text=True, capture_output=True, check=True)
            self.assertIn('nothing changed', again.stdout)

    def test_required_mfa_auth_gate_is_present(self):
        login = (ROOT / 'src/app/api/auth/login/route.ts').read_text()
        self.assertIn('issueStaffMfaChallenge', login)
        self.assertIn('mfaRequired: true', login)
        mfa = (ROOT / 'src/app/api/auth/staff-mfa/route.ts').read_text()
        self.assertIn('A normal staff session exists ONLY after successful', mfa)
        phone = (ROOT / 'src/app/api/auth/phone-otp/route.ts').read_text()
        self.assertIn('await prisma.phoneVerification.updateMany', phone)
        self.assertNotIn('verificationCode: code', phone)

if __name__ == '__main__': unittest.main()

"""Smart Parish: read-only Prisma SQLite account migration preflight.

Run from the existing project root:
    python .\02_auth_preflight.py

This does not modify SQLite or PostgreSQL. It never prints email addresses,
password hashes, MFA secrets, session tokens or other account data.
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path
from urllib.parse import quote

AUTH_TABLES = (
    "User",
    "Session",
    "EmailVerificationToken",
    "PasswordResetToken",
    "StaffMfa",
    "StaffMfaChallenge",
    "PhoneVerification",
)


def open_ro(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SystemExit(f"ERROR: Database file not found: {path}")
    uri = "file:" + quote(path.resolve().as_posix(), safe="/:") + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.execute("PRAGMA query_only=ON")
    return conn


def column_names(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f'PRAGMA table_info("{table}")')}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--auth", type=Path, default=Path("dev.db"))
    parser.add_argument("--archive", type=Path, default=Path("church_backend/instance/archive.db"))
    args = parser.parse_args()
    auth = open_ro(args.auth)
    archive = None
    try:
        if auth.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise SystemExit("STOP: Auth SQLite integrity check failed.")
        if auth.execute("PRAGMA foreign_key_check").fetchone():
            raise SystemExit("STOP: Auth SQLite has broken foreign keys.")
        found = {r[0] for r in auth.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        missing = set(AUTH_TABLES) - found
        if missing:
            raise SystemExit("STOP: Missing authentication tables: " + ", ".join(sorted(missing)))
        print("AUTH DATABASE: integrity OK; foreign keys OK")
        for t in AUTH_TABLES:
            count = auth.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
            print(f"  {t:27} rows={count}")
        print("ROLE COUNTS (no account details):")
        for role, count in auth.execute('SELECT role, COUNT(*) FROM "User" GROUP BY role ORDER BY role'):
            print(f"  {role}: {count}")
        cols = column_names(auth, "User")
        expected = {"id", "email", "password", "role", "emailVerified", "googleSub"}
        if expected - cols:
            raise SystemExit("STOP: User table missing expected columns: " + ", ".join(sorted(expected - cols)))
        duplicate_emails = auth.execute(
            'SELECT COUNT(*) FROM (SELECT lower(email) k FROM "User" GROUP BY k HAVING COUNT(*) > 1)'
        ).fetchone()[0]
        if duplicate_emails:
            raise SystemExit(f"STOP: {duplicate_emails} case-insensitive email collision group(s).")
        print("EMAIL UNIQUENESS (case-insensitive): OK")

        if not args.archive.is_file():
            print("ARCHIVE CROSS-CHECK: Skipped; archive.db not found at expected path.")
        else:
            archive = open_ro(args.archive)
            if archive.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise SystemExit("STOP: Archive SQLite integrity check failed.")
            tables = {r[0] for r in archive.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )}
            if "certificate_request" not in tables or "requester_user_id" not in column_names(archive, "certificate_request"):
                print("ARCHIVE CROSS-CHECK: No legacy requester_user_id column; review needed.")
            else:
                ids = {r[0] for r in auth.execute('SELECT id FROM "User"')}
                owners = [r[0] for r in archive.execute(
                    "SELECT requester_user_id FROM certificate_request WHERE requester_user_id IS NOT NULL"
                )]
                missing_count = sum(1 for owner in owners if owner not in ids)
                print(f"ARCHIVE REQUEST OWNERS: {len(owners)} non-null references checked; {missing_count} unmatched")
                if missing_count:
                    raise SystemExit("STOP: Some archive request owners do not exist in this dev.db. Confirm source files before migration.")
        print("PREFLIGHT PASS: no data copied or modified. Review counts before any remote account import.")
    finally:
        auth.close()
        if archive:
            archive.close()


if __name__ == "__main__":
    main()

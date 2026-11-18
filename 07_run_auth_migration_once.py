"""One-command Smart Parish Supabase STAGING auth importer.

Save alongside 03_migrate_auth.py, 06_verify_staging.py and dev.db.
Run: python .\07_run_auth_migration_once.py

Prompts once for database password, connects via SQLAlchemy URL.create (no
PowerShell URL encoding), verifies archive staging and local backups, then
imports to an ABSENT parish_auth schema or verifies one already present.
Never prints/stores passwords; does not change the working application's .env.
"""
from __future__ import annotations

import getpass
import os
from pathlib import Path
import runpy
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError

HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
USER = "postgres.tuayluohgmiriwjifmec"


def run_script(script: str, *flags: str) -> None:
    if not Path(script).is_file():
        raise SystemExit(f"Missing {script} in current folder. Place this file alongside the other migration scripts.")
    previous = sys.argv
    try:
        sys.argv = [script, *flags]
        runpy.run_path(str(Path(script).resolve()), run_name="__main__")
    finally:
        sys.argv = previous


def backups_ok() -> bool:
    base = Path.home() / "SmartParish-Migration-Backup"
    if not base.is_dir():
        return False
    for folder in base.iterdir():
        if not folder.is_dir():
            continue
        a = folder / "archive.db"
        u = folder / "dev.db"
        if a.is_file() and u.is_file() and a.stat().st_size > 0 and u.stat().st_size > 0:
            return True
    return False


def main() -> None:
    print("Smart Parish: Supabase staging authentication migration")
    for name in ("dev.db", "03_migrate_auth.py", "06_verify_staging.py"):
        if not Path(name).is_file():
            raise SystemExit(f"Missing {name} in the current folder. Open your backup-church project folder first.")
    if not backups_ok():
        raise SystemExit("No paired nonempty dev.db + archive.db backups found under ~/SmartParish-Migration-Backup/<timestamp>. STOP and verify backups before importing.")
    print("Local database backup copies located (both files nonempty).")

    password = getpass.getpass("Supabase database password (hidden): ")
    url = URL.create(
        "postgresql+psycopg",
        username=USER,
        password=password,
        host=HOST,
        port=5432,
        database="postgres",
    )
    del password
    engine = create_engine(url, connect_args={"sslmode": "require", "connect_timeout": 10}, pool_pre_ping=True)
    try:
        try:
            with engine.connect() as conn:
                if conn.scalar(text("SELECT 1")) != 1:
                    raise SystemExit("Connection check returned an unexpected value; STOP.")
                print("SUPABASE CONNECTION: SUCCESS")
                # Guard against accidentally connecting to a new/wrong project.
                existing_archive = conn.scalar(text("SELECT to_regclass('parish_private.certificate_request') IS NOT NULL"))
                if not existing_archive:
                    raise SystemExit("Expected staging archive schema missing: wrong project or archive not yet imported. STOP.")
                existing_auth = conn.scalar(text("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'parish_auth')"))
                print("Existing staging archive: found")
        except SQLAlchemyError as exc:
            print("Connection or database check failed; no import was performed.")
            print(f"Error: {type(exc).__name__} (verify credentials and connection; do not share password)")
            raise SystemExit(1) from None
    finally:
        engine.dispose()

    # The importer expects an environment URL, but the password is constructed
    # safely using SQLAlchemy, not via PowerShell or manual %-encoding.
    os.environ["ARCHIVE_POSTGRES_URL"] = url.render_as_string(hide_password=False)
    try:
        if existing_auth:
            print("parish_auth already exists. VERIFYING ONLY; no import will run.")
            run_script("03_migrate_auth.py", "--verify")
        else:
            print("Importing auth into a new private staging schema...")
            run_script("03_migrate_auth.py", "--apply", "--backups-verified")
        run_script("06_verify_staging.py")
        print("STAGING AUTH MIGRATION AND CHECKS: COMPLETED")
        print("Live Flask / Next.js settings were not changed.")
    finally:
        os.environ.pop("ARCHIVE_POSTGRES_URL", None)


if __name__ == "__main__":
    main()

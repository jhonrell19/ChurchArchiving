from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATABASES = {
    "prisma_dev.db": ROOT / "dev.db",
    "flask_archive.db": ROOT / "church_backend" / "instance" / "archive.db",
}


def integrity_check(db_path: Path) -> str:
    uri = db_path.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=15) as con:
        row = con.execute("PRAGMA integrity_check").fetchone()
        return str(row[0]) if row else "no result"


def backup_database(source: Path, destination: Path) -> None:
    source_uri = source.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(source_uri, uri=True, timeout=30) as src:
        with sqlite3.connect(destination, timeout=30) as dst:
            src.backup(dst, pages=256, sleep=0.05)


def main() -> int:
    missing = [str(path) for path in DATABASES.values() if not path.is_file()]
    if missing:
        print("BACKUP STOPPED. These expected database files were not found:")
        for item in missing:
            print(f"  - {item}")
        return 2

    bad = []
    for name, path in DATABASES.items():
        result = integrity_check(path)
        print(f"Source {name}: {result}")
        if result.lower() != "ok":
            bad.append((name, result))
    if bad:
        print("BACKUP STOPPED because a source database failed integrity_check.")
        return 3

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = ROOT.parent / f"{ROOT.name}_database_backups" / f"pre_migration_{stamp}"
    output_dir.mkdir(parents=True, exist_ok=False)

    try:
        for name, source in DATABASES.items():
            destination = output_dir / name
            backup_database(source, destination)
            result = integrity_check(destination)
            print(f"Backup {name}: {result} ({destination.stat().st_size:,} bytes)")
            if result.lower() != "ok":
                raise RuntimeError(f"Backup integrity check failed for {name}: {result}")
    except Exception as exc:
        print(f"BACKUP FAILED: {type(exc).__name__}: {exc}")
        print(f"Partial backup folder retained for inspection: {output_dir}")
        return 4

    print("\nBACKUP COMPLETE. No source database was modified.")
    print(f"Backup folder: {output_dir}")
    print("The backup folder is outside the Git repository. Keep it until migrations are verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

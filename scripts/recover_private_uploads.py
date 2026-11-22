"""Preview / safely migrate recovered legacy uploads into a private Supabase S3 bucket.

Dry-run is default. Does not rewrite document, request or Mass rows.
Requires PG* connection settings (password prompted, never printed); --apply
additionally requires PARISH_S3_* in the invoking environment, and explicit
confirmation of the target private bucket. Keep source originals/backups.
"""
import argparse
from collections import Counter
from getpass import getpass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
import tempfile

import psycopg


SQL_FILES = """
SELECT filepath AS path, 'archive' AS kind FROM parish_private.document
UNION ALL
SELECT generated_file, 'certificate' FROM parish_private.certificate_request
UNION ALL
SELECT draft_file, 'certificate_draft' FROM parish_private.certificate_request
UNION ALL
SELECT filepath, 'mass' FROM parish_private.mass_record
UNION ALL
SELECT transcript_filepath, 'mass_transcript' FROM parish_private.mass_record
"""


def sha256(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def logical_path(value):
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.replace("\\", "/").strip()
    parts = PurePosixPath(raw).parts
    if (len(parts) < 3 or parts[0] != "uploads"
            or any(part in ("..", ".", "") for part in parts)
            or "//" in raw or "\x00" in raw
            or any(":" in part for part in parts)):
        return None
    return "/".join(parts)


def scanned_original_paths(conn):
    rows = conn.execute(
        "SELECT extracted_metadata FROM parish_private.document "
        "WHERE extracted_metadata IS NOT NULL"
    )
    for (raw,) in rows:
        try:
            meta = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if isinstance(meta, dict):
            original = meta.get("_archive_original_scan")
            if isinstance(original, dict):
                yield original.get("path"), "original_scan"


def candidates(conn):
    values = set()
    for path, kind in conn.execute(SQL_FILES):
        values.add((path, kind))
    values.update(scanned_original_paths(conn))
    return sorted(values, key=lambda r: (str(r[0]), r[1]))


def resolve_candidate(path, roots):
    relative = Path(*PurePosixPath(path).parts[1:])
    found = []
    for root in roots:
        candidate = (root / relative).resolve()
        if not candidate.is_relative_to(root):
            raise ValueError("Recovery path escaped source directory.")
        if candidate.is_file() and not candidate.is_symlink():
            found.append(candidate)
    if not found:
        return None
    digests = {sha256(p) for p in found}
    if len(digests) != 1:
        raise ValueError("Source directories contain conflicting copies of a referenced file.")
    return found[0]


def pg_connection():
    params = dict(
        host=os.environ["PGHOST"],
        port=os.environ.get("PGPORT", "5432"),
        user=os.environ["PGUSER"],
        dbname=os.environ.get("PGDATABASE", "postgres"),
        sslmode="verify-full",
        sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=12,
    )
    params["password"] = getpass("Supabase database password (hidden): ")
    return psycopg.connect(**params)


def private_storage(conn, expected):
    row = conn.execute(
        "SELECT public FROM storage.buckets WHERE id = %s", (expected,)
    ).fetchone()
    if row is None or row[0] is not False:
        raise ValueError("Target bucket is missing or PUBLIC; refusing migration.")
    return expected


def s3_client():
    import boto3
    endpoint = os.environ["PARISH_S3_ENDPOINT"]
    if not endpoint.startswith("https://"):
        raise ValueError("S3 endpoint must be HTTPS.")
    return boto3.client(
        "s3", endpoint_url=endpoint,
        region_name=os.environ["PARISH_S3_REGION"],
        aws_access_key_id=os.environ["PARISH_S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["PARISH_S3_SECRET_KEY"],
    )


def migrate_one(conn, client, bucket, path, physical):
    size = physical.stat().st_size
    digest = sha256(physical)
    category = path.split("/")[1]
    with conn.transaction():
        # Never overwrite an existing mapped object, even if it is missing remotely.
        mapped = conn.execute(
            "SELECT sha256 FROM parish_private.upload_object "
            "WHERE logical_path = %s FOR UPDATE", (path,)
        ).fetchone()
        if mapped:
            return "already_indexed"
        quota = conn.execute(
            "SELECT byte_limit, max_file_bytes FROM parish_private.storage_quota "
            "WHERE category=%s FOR UPDATE", (category,)
        ).fetchone()
        if quota is None:
            raise ValueError("No storage quota exists for category " + category)
        usage = conn.execute(
            "SELECT COALESCE(sum(size_bytes), 0) FROM parish_private.upload_object "
            "WHERE split_part(logical_path, '/', 2)=%s", (category,)
        ).fetchone()[0]
        if size <= 0 or size > quota[1] or usage + size > quota[0]:
            raise ValueError("Recovered file exceeds the configured private-storage quota.")
        # Upload under content digest; verify by reading it back before indexing.
        client.upload_file(str(physical), bucket, "parish/" + digest)
        with tempfile.TemporaryDirectory(prefix="parish-verify-") as tmp:
            readback = Path(tmp) / "object"
            client.download_file(bucket, "parish/" + digest, str(readback))
            if readback.stat().st_size != size or sha256(readback) != digest:
                raise ValueError("Private object upload checksum verification failed.")
        conn.execute(
            "INSERT INTO parish_private.upload_object "
            "(logical_path, sha256, size_bytes) VALUES (%s,%s,%s)",
            (path, digest, size),
        )
    return "uploaded"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, action="append", required=True,
                        help="Directory containing copied files under category/filename")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-bucket",
                        help="Explicit exact bucket name, required with --apply")
    args = parser.parse_args()
    roots = [r.resolve(strict=True) for r in args.source]
    if not all(p.is_dir() for p in roots):
        raise ValueError("Every recovery source must be a directory.")
    with pg_connection() as conn:
        # Keep the scope fixed to the existing Supabase parish database.
        if conn.execute("SELECT current_database()").fetchone()[0] != "postgres":
            raise ValueError("Unexpected database; check Supabase connection.")
        counts = Counter()
        matched = {}
        for raw, kind in candidates(conn):
            path = logical_path(raw)
            if not path:
                counts[(kind, "non_local_or_invalid")] += 1
                continue
            physical = resolve_candidate(path, roots)
            if physical is None:
                counts[(kind, "missing")] += 1
                continue
            matched[path] = physical
            counts[(kind, "found")] += 1
        print("Referenced files:", sum(counts.values()))
        for (kind, result), number in sorted(counts.items()):
            print(kind, result, number)
        print("Unique local files found:", len(matched))
        if not args.apply:
            print("DRY RUN ONLY. No files or database rows were changed.")
            return 0
        bucket = os.environ["PARISH_S3_BUCKET"]
        if args.confirm_bucket != bucket:
            raise ValueError("Supply --confirm-bucket with the exact private bucket name.")
        private_storage(conn, bucket)
        client = s3_client()
        client.head_bucket(Bucket=bucket)
        results = Counter()
        for path, physical in sorted(matched.items()):
            try:
                results[migrate_one(conn, client, bucket, path, physical)] += 1
            except Exception as exc:
                conn.rollback()
                # Deliberately omit sensitive path and provider exception details.
                print("File migration failed for a referenced item:", type(exc).__name__,
                      file=sys.stderr)
                results["failed"] += 1
        print("Migration results:", dict(results))
        print("Original source files are unchanged.")
        return 1 if results["failed"] else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, psycopg.Error, KeyError) as exc:
        print("Recovery stopped:", type(exc).__name__, file=sys.stderr)
        raise SystemExit(2)

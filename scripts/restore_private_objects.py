"""Restore immutable parish snapshot objects to a separate TEST private bucket.

This tool never alters PostgreSQL and defaults to dry run. Verify bucket privacy
in Supabase before setting PARISH_RESTORE_TEST_BUCKET_PRIVATE_CONFIRMED=YES.
Never use the live parish bucket as the restore destination.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def inspect_snapshot(root):
    root = root.resolve(strict=True)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != 1 or not isinstance(manifest.get("files"), dict):
        raise ValueError("Unsupported backup manifest.")
    entries = manifest["files"]
    if "parish.dump" not in entries:
        raise ValueError("Snapshot has no PostgreSQL dump.")
    objects = []
    for name, expected in entries.items():
        if name != "parish.dump" and not re.fullmatch(r"objects/[a-f0-9]{64}", name):
            raise ValueError("Unexpected file in manifest.")
        file = root / name
        if not file.is_file() or not file.resolve().is_relative_to(root):
            raise ValueError("Missing or unsafe backup entry.")
        if not re.fullmatch(r"[a-f0-9]{64}", expected) or sha256(file) != expected:
            raise ValueError("Backup checksum mismatch.")
        if name.startswith("objects/"):
            if name.split("/", 1)[1] != expected:
                raise ValueError("Object filename and content hash differ.")
            objects.append((expected, file))
    return objects


def restore_test_objects(snapshot, apply):
    objects = inspect_snapshot(snapshot)
    target = os.environ.get("PARISH_RESTORE_TEST_BUCKET", "")
    live = os.environ.get("PARISH_S3_BUCKET", "")
    if not target or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,62}", target):
        raise ValueError("Set a valid PARISH_RESTORE_TEST_BUCKET.")
    if live and target == live:
        raise ValueError("Refusing to restore objects into the live source bucket.")
    print("Verified backup objects:", len(objects))
    print("Restore destination bucket:", target)
    if not apply:
        print("DRY RUN ONLY. No objects uploaded.")
        return
    if os.environ.get("PARISH_RESTORE_TEST_BUCKET_PRIVATE_CONFIRMED") != "YES":
        raise ValueError("Inspect test bucket privacy in Supabase first.")
    import boto3
    endpoint = os.environ.get("PARISH_RESTORE_S3_ENDPOINT", "")
    if not endpoint.startswith("https://"):
        raise ValueError("HTTPS test endpoint is required.")
    client = boto3.client(
        "s3", endpoint_url=endpoint,
        region_name=os.environ["PARISH_RESTORE_S3_REGION"],
        aws_access_key_id=os.environ["PARISH_RESTORE_S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["PARISH_RESTORE_S3_SECRET_KEY"],
    )
    client.head_bucket(Bucket=target)
    for digest, file in objects:
        key = "parish/" + digest
        client.upload_file(str(file), target, key)
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            copy = Path(temp) / "verify-object"
            client.download_file(target, key, str(copy))
            if sha256(copy) != digest:
                raise ValueError("Uploaded test object failed checksum verification.")
    print("RESTORED AND VERIFIED:", len(objects), "objects")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--apply", action="store_true", help="Upload to isolated test bucket, never live")
    args = parser.parse_args()
    try:
        restore_test_objects(args.snapshot, args.apply)
    except (OSError, ValueError, KeyError) as error:
        print("Restore refused:", error, file=sys.stderr)
        sys.exit(2)

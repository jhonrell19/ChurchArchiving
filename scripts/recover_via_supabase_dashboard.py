"""Dashboard-based recovery when Supabase S3 requests fail.

PREPARE (read-only database): copies recovered files into an *external*
directory named parish/<sha256> and creates a private manifest.
Then upload the *contents* of parish/ into Supabase Storage bucket
smart-parish-private, folder parish/, with Supabase Dashboard.
INDEX (database write): only after every expected object appears in
storage.objects with matching size; never touches old document references.
Do not store the manifest or exported objects in Git.
"""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import shutil
import sys

from recover_private_uploads import candidates, logical_path, resolve_candidate, pg_connection, sha256


def prepare(args):
    target = args.output.expanduser().resolve()
    if target.exists():
        raise ValueError("Choose a NEW output directory: refusing to replace existing recovery data.")
    source_roots = [r.resolve(strict=True) for r in args.source]
    if not all(r.is_dir() for r in source_roots):
        raise ValueError("Recovery source is not a directory.")
    discovered = {}
    counts = Counter()
    with pg_connection() as conn:
        for original, kind in candidates(conn):
            if not args.include_mass and kind.startswith("mass"):
                continue
            path = logical_path(original)
            if not path:
                counts["invalid_or_external"] += 1
                continue
            physical = resolve_candidate(path, source_roots)
            if physical is None:
                counts["missing"] += 1
                continue
            size = physical.stat().st_size
            if size <= 0:
                counts["empty"] += 1
                continue
            discovered[path] = dict(kind=kind, physical=physical, size=size, sha256=sha256(physical))
            counts["found"] += 1
    if not discovered:
        raise ValueError("No recoverable files found; nothing prepared.")
    target.mkdir(mode=0o700, parents=True)
    objects = target / "parish"
    objects.mkdir()
    for item in discovered.values():
        name = item["sha256"]
        out = objects / name
        if not out.exists():
            shutil.copyfile(item["physical"], out)
        if out.stat().st_size != item["size"] or sha256(out) != name:
            raise ValueError("A copied object failed checksum verification.")
    manifest = dict(version=1, bucket=args.bucket,
                    files=[dict(path=path, kind=item["kind"],
                                sha256=item["sha256"], size=item["size"])
                           for path, item in sorted(discovered.items())])
    (target / "recovery_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("RECOVERY PACKAGE PREPARED")
    print("Category results:", dict(counts))
    print("Distinct database paths:", len(discovered))
    print("Unique file objects:", len({i["sha256"] for i in discovered.values()}))
    print("Files for dashboard upload: directory parish/ (inside your output folder)")
    print("DO NOT upload recovery_manifest.json. Keep it local and private.")
    print("No database records or Supabase objects were changed.")
    return 0


def index(args):
    root = args.output.expanduser().resolve(strict=True)
    manifest = json.loads((root / "recovery_manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != 1 or manifest.get("bucket") != args.confirm_bucket:
        raise ValueError("Manifest or expected bucket mismatch.")
    if not args.confirm_bucket or args.confirm_bucket != "smart-parish-private":
        raise ValueError("Confirm the exact private Supabase bucket name.")
    files = manifest.get("files", [])
    if not isinstance(files, list) or not files:
        raise ValueError("Manifest contains no recovery entries.")
    with pg_connection() as conn:
        found = conn.execute(
            "SELECT public FROM storage.buckets WHERE id=%s",
            (args.confirm_bucket,),
        ).fetchone()
        if not found or found[0] is not False:
            raise ValueError("Destination bucket must exist and be private.")
        # Check every object before writing ANY upload indexes.
        unique = {}
        paths = set()
        for item in files:
            path, digest, size = item["path"], item["sha256"], item["size"]
            if path in paths or logical_path(path) != path:
                raise ValueError("Duplicate or unsafe path in recovery manifest.")
            paths.add(path)
            if len(digest) != 64 or not all(c in "0123456789abcdef" for c in digest):
                raise ValueError("Invalid digest in manifest.")
            object_file = root / "parish" / digest
            if not object_file.is_file() or object_file.stat().st_size != size or sha256(object_file) != digest:
                raise ValueError("Local recovery package checksum failed.")
            unique[digest] = size
        for digest, size in unique.items():
            entry = conn.execute(
                "SELECT metadata FROM storage.objects WHERE bucket_id=%s AND name=%s",
                (args.confirm_bucket, "parish/" + digest),
            ).fetchone()
            if not entry:
                raise ValueError("Not all recovered objects have been uploaded to the private bucket.")
            metadata = entry[0] if isinstance(entry[0], dict) else {}
            try:
                remote_size = int(metadata.get("size"))
            except (ValueError, TypeError):
                raise ValueError("Uploaded object metadata size is unavailable.")
            if remote_size != size:
                raise ValueError("Uploaded object size does not match recovered backup.")
        print("PRECHECK PASSED:", len(unique), "objects visible in private Supabase bucket.")
        print("Database paths to index:", len(files))
        if not args.apply:
            print("DRY RUN ONLY. No index rows inserted.")
            return 0
        if args.ack != "INDEX":
            raise ValueError("For a database write, supply --ack INDEX.")
        with conn.transaction():
            for item in files:
                path, digest, size = item["path"], item["sha256"], item["size"]
                existing = conn.execute(
                    "SELECT sha256,size_bytes FROM parish_private.upload_object WHERE logical_path=%s FOR UPDATE",
                    (path,),
                ).fetchone()
                if existing:
                    if existing != (digest, size):
                        raise ValueError("Existing private upload index conflicts with recovery package.")
                    continue
                category = path.split("/")[1]
                quota = conn.execute(
                    "SELECT byte_limit,max_file_bytes FROM parish_private.storage_quota WHERE category=%s FOR UPDATE",
                    (category,),
                ).fetchone()
                if quota is None or size > quota[1]:
                    raise ValueError("Storage quota missing or maximum file size exceeded.")
                usage = conn.execute(
                    "SELECT COALESCE(sum(size_bytes),0) FROM parish_private.upload_object "
                    "WHERE split_part(logical_path,'/',2)=%s",
                    (category,),
                ).fetchone()[0]
                if usage + size > quota[0]:
                    raise ValueError("Storage category quota exceeded.")
                conn.execute(
                    "INSERT INTO parish_private.upload_object(logical_path,sha256,size_bytes) VALUES(%s,%s,%s)",
                    (path, digest, size),
                )
        print("INDEX COMPLETE:", len(files), "paths checked; existing source files and references retained.")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, action="append", help="Copied recovery source, category/file layout")
    p.add_argument("--output", type=Path, required=True, help="NEW directory outside Git")
    p.add_argument("--bucket", default="smart-parish-private")
    p.add_argument("--include-mass", action="store_true", help="Include recovered Mass media files")
    p.add_argument("--index", action="store_true", help="Check dashboard uploaded objects before index")
    p.add_argument("--apply", action="store_true", help="Write index only after --index and --ack INDEX")
    p.add_argument("--confirm-bucket")
    p.add_argument("--ack")
    args = p.parse_args()
    if args.index:
        return index(args)
    if args.apply:
        p.error("--apply is valid only with --index.")
    if not args.source:
        p.error("--source is required for package preparation.")
    return prepare(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as exc:
        print("RECOVERY STOPPED:", type(exc).__name__, str(exc) if isinstance(exc, ValueError) else "",
              file=sys.stderr)
        raise SystemExit(2)

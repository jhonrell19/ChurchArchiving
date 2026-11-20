"""Compare two private upload snapshots. Prints counts only. Requires Python 3.11+."""
import argparse
from collections import Counter
import hashlib
import os
from pathlib import Path
import stat
import sys


def digest(path):
    with path.open("rb") as handle:
        before = os.fstat(handle.fileno())
        result = hashlib.file_digest(handle, "sha256").digest()
        after = path.stat()
    if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
        after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns
    ):
        raise ValueError("A file changed during verification.")
    return result


def scan(root):
    files = {}
    for directory, children, names in os.walk(root, onerror=raise_scan_error):
        for name in children + names:
            path = Path(directory) / name
            info = path.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise ValueError("A snapshot contains a link or reparse point.")
            if stat.S_ISREG(info.st_mode):
                files[path.relative_to(root)] = digest(path)
            elif not stat.S_ISDIR(info.st_mode):
                raise ValueError("A snapshot contains a special file.")
    return files


def raise_scan_error(error):
    raise error


def verify(source, backup):
    source, backup = source.resolve(strict=True), backup.resolve(strict=True)
    if not source.is_dir() or not backup.is_dir():
        raise ValueError("Select two directories.")
    if source.is_relative_to(backup) or backup.is_relative_to(source):
        raise ValueError("Select separate, non-overlapping snapshot directories.")
    expected, actual = scan(source), scan(backup)
    if not expected:
        raise ValueError("Source contains no files. A restore cannot be verified.")
    counts = Counter()
    for path, checksum in expected.items():
        if path not in actual:
            counts["missing"] += 1
        elif checksum != actual[path]:
            counts["different"] += 1
        else:
            counts["matched"] += 1
    counts["extra"] = len(actual.keys() - expected.keys())
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("restored_copy", type=Path)
    args = parser.parse_args()
    try:
        counts = verify(args.source, args.restored_copy)
    except OSError:
        print("Unable to read both snapshots completely.", file=sys.stderr)
        return 2
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(" ".join(f"{key}={counts[key]}" for key in ("matched", "missing", "different", "extra")))
    return int(any(counts[key] for key in ("missing", "different", "extra")))


if __name__ == "__main__":
    sys.exit(main())

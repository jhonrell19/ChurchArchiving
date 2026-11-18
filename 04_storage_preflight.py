"""Read-only local files inventory for Smart Parish Supabase Storage planning.

  python 04_storage_preflight.py
  python 04_storage_preflight.py --source church_backend/instance/archive.db

No files are uploaded or copied. Does not print personal filenames or contents.
"""
from pathlib import Path
import sqlite3
import collections
import argparse

FIELD_QUERIES = {
    'document': ('filepath',),
    'certificate_request': ('draft_file','generated_file'),
    'mass_record': ('filepath','transcript_filepath'),
    'cemetery_reservation': ('contract_file',),
    'burial_record': ('death_certificate_file','burial_permit_file','authorization_file'),
}

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source',type=Path,default=Path('church_backend/instance/archive.db'))
    p.add_argument('--uploads',type=Path,default=Path('church_backend/uploads'))
    args = p.parse_args()
    if not args.source.is_file():
        raise SystemExit('SQLite archive not found. Run from project root.')
    conn=sqlite3.connect(f'file:{args.source.resolve().as_posix()}?mode=ro',uri=True)
    conn.execute('PRAGMA query_only=1')
    root=args.uploads.resolve()
    actual_files=[]
    if root.is_dir():
        actual_files=[f for f in root.rglob('*') if f.is_file() and not f.is_symlink()]
    refs=[]
    try:
        tables={r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table, fields in FIELD_QUERIES.items():
            if table not in tables: continue
            available={r[1] for r in conn.execute(f'PRAGMA table_info("{table}")')}
            for field in fields:
                if field not in available: continue
                refs += [(table, str(r[0])) for r in conn.execute(f'SELECT "{field}" FROM "{table}" WHERE "{field}" IS NOT NULL AND trim("{field}") != \'\'')]
    finally:
        conn.close()
    total_bytes=sum(f.stat().st_size for f in actual_files)
    by_ext=collections.defaultdict(lambda:[0,0])
    for f in actual_files:
        e=f.suffix.lower() or '(none)'
        by_ext[e][0]+=1; by_ext[e][1]+=f.stat().st_size
    found=missing=external=unsafe=0
    for table,value in refs:
        value=value.replace('\\','/').lstrip('/')
        if value.startswith(('https://','http://')):
            external+=1; continue
        rel=value[len('uploads/'):] if value.startswith('uploads/') else value
        candidate=(root / rel).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            unsafe+=1; continue
        if candidate.is_file():found+=1
        else:missing+=1
    print('STORAGE INVENTORY: READ ONLY')
    print(f'Files on disk: {len(actual_files)}; total bytes: {total_bytes}')
    for ext, (n, size) in sorted(by_ext.items()):
        print(f'  {ext:10} files={n:5} bytes={size}')
    print(f'DB file references: {len(refs)}')
    print(f'  locally found={found}, missing={missing}, external links={external}, unsafe paths={unsafe}')
    print('No upload has been performed. Video files require a separate YouTube/retention policy.')
    if missing or unsafe:
        print('WARNING: Investigate missing/unsafe paths before switching off local files.')

if __name__=='__main__': main()

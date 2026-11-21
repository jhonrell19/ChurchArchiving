"""Copy indexed archive documents from the existing upload disk into private storage."""
import argparse
from pathlib import Path

from sqlalchemy import select, text
from server import app, db, Document, backend_storage_path, normalize_path, _archive_original_scan
import private_uploads


def sync(apply):
    if not private_uploads.enabled():
        raise RuntimeError("Configure PARISH_PRIVATE_UPLOADS before running the archive copy.")
    private_uploads.private_bucket()
    last_id = copied = missing = pending = 0
    while True:
        ids = db.session.scalars(select(Document.id).where(Document.id > last_id)
                                 .order_by(Document.id).limit(100)).all()
        if not ids:
            break
        for doc_id in ids:
            last_id = doc_id
            with db.session.begin_nested():
                doc = db.session.get(Document, doc_id, with_for_update=True)
                if not doc:
                    continue
                source, _ = _archive_original_scan(doc)
                for path in dict.fromkeys([normalize_path(doc.filepath), source]):
                    if not path:
                        continue
                    if not path.startswith((f'uploads/{doc.sacrament_type}/', 'uploads/archive_filled/')):
                        raise ValueError(f"Unexpected archive location on record {doc_id}.")
                    if db.session.scalar(text('SELECT 1 FROM parish_private.upload_object WHERE logical_path=:p'), {'p': path}):
                        continue
                    physical = Path(backend_storage_path(path))
                    if not physical.is_file():
                        missing += 1
                        print(f"Record {doc_id}: missing local file")
                    else:
                        pending += 1
                        if apply:
                            private_uploads.preserve(path, physical)
                            copied += 1
            db.session.commit()
    print(f"Files requiring copy: {pending}; copied: {copied}; missing: {missing}")
    return 1 if missing else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Copy available files; default is inventory only.')
    with app.app_context():
        raise SystemExit(sync(parser.parse_args().apply))

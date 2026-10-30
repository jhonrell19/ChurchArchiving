#!/usr/bin/env python3
"""Safely enable Certificate of Ownership in the Smart Parish System.

Run from project root: python apply_ownership_certificate.py
Self-contained; no `files` folder is necessary. Does not touch DB, venv, .env, or uploads.
"""
from pathlib import Path
from datetime import datetime
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
EDIT_GROUPS = {}

def edit(path: str, old: str, new: str):
    EDIT_GROUPS.setdefault(path, []).append((old, new))

# User request options, display, backend category, existing-request history.
u = 'src/app/dashboard/components/RequestsPage.tsx'
edit(u, "  | 'Burial Certificate'", "  | 'Certificate of Ownership'")
edit(u, "  'Burial Certificate': 100,", "  'Certificate of Ownership': 100,")
edit(u, "  'Burial Certificate',", "  'Certificate of Ownership',")
edit(u, "  'Burial Certificate': REQUEST_ICONS['Burial Certificate'] || 'ti-candle',", "  'Certificate of Ownership': REQUEST_ICONS['Certificate of Ownership'] || 'ti-file-certificate',")
edit(u, "    case 'Burial Certificate':\n      return 'burial'", "    case 'Certificate of Ownership':\n      return 'ownership'")
edit(u, "    case 'burial':\n      return 'Burial Certificate'", "    case 'ownership':\n      return 'Certificate of Ownership'\n    case 'burial':\n    case 'death':\n      return 'Historical Burial Request'")
edit(u, "    case 'Burial Certificate':\n    case 'burial':\n      return REQUEST_TYPE_ICONS['Burial Certificate']", "    case 'Certificate of Ownership':\n    case 'ownership':\n      return REQUEST_TYPE_ICONS['Certificate of Ownership']\n    case 'burial':\n    case 'death':\n      return 'ti-archive'")
edit(u, "Request parish certificates, burial certificates, or land agreement copies.", "Request parish certificates, certificates of ownership, or land agreement copies.")
edit(u, "                  Name on Record <span className=\"text-gold\">*</span>", "                  {activeType === 'Certificate of Ownership' ? 'Registered Lot Holder' : 'Name on Record'} <span className=\"text-gold\">*</span>")
edit(u, 'placeholder="Name written on church record"', 'placeholder={activeType === \'Certificate of Ownership\' ? \'Name of registered lot holder\' : \'Name written on church record\'}')
edit(u, "                  Approximate Record Date / Year", "                  {activeType === 'Certificate of Ownership' ? 'Agreement Date / Year (if known)' : 'Approximate Record Date / Year'}")
edit(u, "                  Identifying Details\n", "                  {activeType === 'Certificate of Ownership' ? 'Lot / Reservation Reference' : 'Identifying Details'}\n")
edit(u, 'placeholder="Parents, spouse, book/page, or other known detail"', "placeholder={activeType === 'Certificate of Ownership' ? 'Section, block, lot number, reservation number' : 'Parents, spouse, book/page, or other known detail'}")
edit(u, "                  Your requester information comes from your registered account.\n", "                  Your requester information comes from your registered account.\n") # no-op (kept for clarity)

# User request category icons.
edit('src/app/dashboard/data/ui.ts', "  'Burial Certificate': 'ti-candle',", "  'Certificate of Ownership': 'ti-file-certificate',")

# Burial-admin archive: new ownership category; historical burial stays in database.
a = 'src/app/burial-admin/components/BurialArchivesPage.tsx'
edit(a, "  { label: 'Burial Certificate', value: 'burial', icon: 'ti-candle' },", "  { label: 'Certificate of Ownership', value: 'ownership', icon: 'ti-file-certificate' },")
edit(a, "const [activeTab, setActiveTab] = useState('burial')", "const [activeTab, setActiveTab] = useState('ownership')")
edit(a, "  sacrament_type: 'burial',", "  sacrament_type: 'ownership',")
edit(a, '                <option value="burial">Burial Certificate</option>', '                <option value="ownership">Certificate of Ownership</option>')
edit(a, '                Sacrament Type *', '                Document Category *')
edit(a, '                Full Name *', '                Registered Holder / Name on Document *')
edit(a, 'placeholder="Name on record"', 'placeholder="Registered holder or name on document"')
edit(a, '          Digital Church Archives', '          Cemetery Document Archives')
edit(a, '        Store scanned church records with metadata, categorization, and searchable archive retrieval.', '        Store verified ownership certificates and land agreements for cemetery document requests.')

# Sidebar and shared staff request processing labels.
edit('src/app/burial-admin/page.tsx', "{ id: 'requests', label: 'Burial Requests', icon: 'ti-inbox' },", "{ id: 'requests', label: 'Document Requests', icon: 'ti-inbox' },")
s = 'src/app/admin/components/RequestsPage.tsx'
edit(s, "    case 'burial':\n    case 'death':\n      return 'Burial Certificate'", "    case 'ownership':\n      return 'Certificate of Ownership'\n    case 'burial':\n    case 'death':\n      return 'Historical Burial Request'")
# For an ownership request, permit a verified archived Land Agreement as
# supporting evidence; an ownership certificate must not require itself as proof.
edit(s, """      const res = await fetch(
        `/api/backend/api/archive/documents/${encodeURIComponent(item.sacramentType)}?q=${encodeURIComponent(query)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.error || data.message || 'Unable to search the archive.')
        return
      }

      setSearchResults(prev => ({
        ...prev,
        [item.id]: Array.isArray(data.documents) ? data.documents : [],
      }))
""", """      const categories = item.sacramentType === 'ownership'
        ? ['ownership', 'land_agreement']
        : [item.sacramentType]
      const results = await Promise.all(categories.map(async category => {
        const res = await fetch(
          `/api/backend/api/archive/documents/${encodeURIComponent(category)}?q=${encodeURIComponent(query)}`,
          { cache: 'no-store' }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to search the archive.')
        return Array.isArray(data.documents) ? (data.documents as ArchiveDocument[]) : []
      }))
      const unique = new Map<number, ArchiveDocument>()
      for (const record of results.flat()) unique.set(record.id, record)
      setSearchResults(prev => ({
        ...prev,
        [item.id]: Array.from(unique.values()),
      }))
""")
edit(s, '''                            <button
                              type="button"
                              disabled={isBusy || !item.matchedDocumentId}
                              onClick={() => void generateReleaseDocument(item)}''', '''                            {item.sacramentType !== 'ownership' ? (
                            <button
                              type="button"
                              disabled={isBusy || !item.matchedDocumentId}
                              onClick={() => void generateReleaseDocument(item)}''')
edit(s, '''                              Generate Official Form Draft
                            </button>
                            <span className="font-body text-[11px] text-slate-500">
                              Then upload the reviewed/signed final certificate below.
                            </span>''', '''                              Generate Official Form Draft
                            </button>
                            ) : (
                              <span className="font-body text-[11px] text-amber-800">
                                No automatic ownership-certificate template is configured. Verify the ownership record, then upload the approved and signed final document below.
                              </span>
                            )}
                            {item.sacramentType !== 'ownership' && (
                              <span className="font-body text-[11px] text-slate-500">
                                Then upload the reviewed/signed final certificate below.
                              </span>
                            )}''')
edit('src/app/admin/data/ui.ts', "  'Burial Certificate': 'ti-candle',", "  'Certificate of Ownership': 'ti-file-certificate',\n  ownership: 'ti-file-certificate',")
edit('src/app/admin/components/RecycleBinPage.tsx', "  if (type === 'burial') return 'Burial Certificate'", "  if (type === 'ownership') return 'Certificate of Ownership'\n  if (type === 'burial') return 'Historical Burial Document'")

# Next.js role-based backend gate: ownership remains Burial Admin only.
edit('src/app/api/backend/[...path]/route.ts', "new Set(['burial', 'land_agreement'])", "new Set(['burial', 'land_agreement', 'ownership'])")

# Flask archive + request type: keep legacy 'burial' for historic records, but block NEW requests/uploads of that retired category.
b = 'church_backend/server.py'
edit(b, 'BURIAL_ADMIN_TYPES = ["burial", "land_agreement"]', 'BURIAL_ADMIN_TYPES = ["burial", "land_agreement", "ownership"]')
edit(b, '    "land_agreement": "LAG",', '    "land_agreement": "LAG",\n    "ownership": "OWN",')
edit(b, '    "land_agreement": 100,', '    "land_agreement": 100,\n    "ownership": 100,')
edit(b, '''        if sacrament_type not in allowed_types:

            return {"error": "Invalid document category"}, 400''', '''        if sacrament_type not in allowed_types:

            return {"error": "Invalid document category"}, 400

        if sacrament_type == "burial":
            return {"error": "New burial certificate archives are retired. Use Certificate of Ownership for the appropriate document instead."}, 400''')
edit(b, '''        if sacrament_type not in (

            MAIN_ADMIN_TYPES

            + BURIAL_ADMIN_TYPES

        ):''', '''        if sacrament_type == "burial":
            return {"error": "Burial certificate requests are no longer offered. Select Certificate of Ownership instead."}, 400

        if sacrament_type not in (

            MAIN_ADMIN_TYPES

            + BURIAL_ADMIN_TYPES

        ):''')

# A new ownership certificate can be based on an archived Land Agreement;
# staff must review it and upload the approved final ownership certificate.
edit(b, """        if document.sacrament_type != cert_request.sacrament_type:
            return {
                "error": "Archive record category does not match the request."
            }, 400
""", """        permitted_source_types = (
            {"ownership", "land_agreement"}
            if cert_request.sacrament_type == "ownership"
            else {cert_request.sacrament_type}
        )
        if document.sacrament_type not in permitted_source_types:
            return {
                "error": "Archive record category does not match the request."
            }, 400
""")

# Official certificate draft is NOT available without a parish-provided template.
edit('church_backend/document_templates.py', "elif sacrament_type in {'burial', 'land_agreement'}:", "elif sacrament_type in {'burial', 'land_agreement', 'ownership'}:")
edit('church_backend/document_templates.py', "'No official Burial/Land Agreement template has been configured yet.'", "'No official Certificate of Ownership / Land Agreement template has been configured yet. Staff must upload a verified, approved final document.'")

# Remove no-op operations.
for filename in list(EDIT_GROUPS):
    EDIT_GROUPS[filename] = [(a, c) for a, c in EDIT_GROUPS[filename] if a != c]


def main():
    missing = [f for f in EDIT_GROUPS if not (ROOT / f).is_file()]
    if missing:
        print('PATCH ABORTED: Run this script inside your project root (with src/, church_backend/, package.json).')
        print('Missing files:\n' + '\n'.join(' - ' + s for s in missing))
        return 1

    # Validate all edits before writing any file, to avoid partially patched code.
    replacements = {}
    errors = []
    for rel, operations in EDIT_GROUPS.items():
        original = (ROOT / rel).read_text(encoding='utf-8')
        updated = original
        for old, new in operations:
            # Skip completed edits first, even if the new snippet contains the old one.
            if new in updated:
                continue
            count = updated.count(old)
            if count == 1:
                updated = updated.replace(old, new, 1)
            elif count == 0 and new in updated:
                # Already applied; supports reruns and manually merged updates.
                continue
            elif count == 0:
                errors.append(f'{rel}: expected snippet missing: {old.strip()[:100]!r}')
            else:
                errors.append(f'{rel}: unexpected {count} occurrences: {old.strip()[:100]!r}')
        if updated != original:
            replacements[rel] = (original, updated)

    if errors:
        print('PATCH ABORTED: Source code differs from expected baseline. NO FILES CHANGED.')
        print('\n'.join(' - ' + issue for issue in errors))
        print('Send this output and the affected files; do not overwrite them with older versions.')
        return 2

    if not replacements:
        print('Everything is already updated. No files changed.')
        return 0

    # Syntax-check Python before altering project.
    for rel, (_, updated) in replacements.items():
        if rel.endswith('.py'):
            try:
                compile(updated, str(ROOT / rel), 'exec')
            except SyntaxError as e:
                print(f'PATCH ABORTED: Python syntax error in {rel}: {e}. NO FILES CHANGED.')
                return 3

    backup_root = ROOT / '.ownership_patch_backups' / datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    try:
        for rel, (original, _) in replacements.items():
            dest = backup_root / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(original, encoding='utf-8')
        for rel, (_, updated) in replacements.items():
            dest = ROOT / rel
            with tempfile.NamedTemporaryFile('w', dir=dest.parent, encoding='utf-8', delete=False) as tmp:
                tmp.write(updated)
                tmp_name = tmp.name
            Path(tmp_name).replace(dest)
    except Exception as e:
        for rel in replacements:
            backup = backup_root / rel
            if backup.is_file():
                shutil.copy2(backup, ROOT / rel)
        print(f'PATCH FAILED: Restored original files from {backup_root}. Reason: {e}')
        return 4

    print('Certificate of Ownership update applied successfully.')
    for rel in replacements:
        print(' UPDATED:', rel)
    print('Backups:', backup_root)
    print('No .env, database, reservation, or font files modified.')
    print('Restart Flask and Next.js; run npx tsc --noEmit and test the request flow.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

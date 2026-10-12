# Smart Parish System — IFI Maragondon

This package contains the coordinated capstone-completion source pass.

Start here:

1. `SETUP_AND_RUN.md` — install, migrate, and run locally.
2. `TESTING_GUIDE.md` — complete end-to-end regression checklist.
3. `COMPLETION_REPORT.md` — what is implemented and what was changed.
4. `PANEL_REVISION_STATUS.md` — panel-request status.
5. `PRODUCTION_DEPLOYMENT_GUIDE.md` — email, OCR, PayMongo/QR Ph, PostgreSQL, storage, HTTPS, WSGI, background jobs.

## Important source-package rule

This distribution intentionally does **not** include private/local runtime data such as `.env`, SQLite databases, real uploads, `venv`, `.next`, or `node_modules`.

When updating an existing working copy, preserve your own:

```text
.env
dev.db
church_backend/instance/archive.db
uploads/
church_backend/uploads/
venv/
```

Then copy the source files from this package over the project and follow `SETUP_AND_RUN.md`.

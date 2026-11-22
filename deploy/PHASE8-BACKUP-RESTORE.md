# Private Supabase backup & restore drill — operator playbook

**No live database or bucket changes are authorized by this document.**
Run these only on an authorized operator workstation with TLS verification, encrypted external storage and an approved test database/bucket. Never paste PG credentials, API keys or object names into issue comments.

## Backup

The repository already has `scripts/backup_private_postgres.py` and `scripts/verify_upload_backup.py`. The backup script captures `parish_auth` and `parish_private` using one database snapshot, copies object hashes listed in `parish_private.upload_object`, and creates a checksum manifest. It does **not** magically recover files already lost from Render's ephemeral disk.

In an isolated private terminal, configure PostgreSQL `PGHOST`, `PGUSER`, `PGDATABASE`, `PGSSLMODE=verify-full`, `PGSSLROOTCERT`, a non-printing `PGPASSFILE`, and the **source** `PARISH_S3_*` private bucket settings. Confirm these are correct before running:

```powershell
pg_dump --version
python scripts/backup_private_postgres.py create D:\ParishBackups
python scripts/backup_private_postgres.py verify D:\ParishBackups\parish-REPLACE_TIMESTAMP
```

Copy the entire snapshot directory to a separate, encrypted drive. Verify the copy with `verify` again. Keep it outside the Git repository.

## Restore into an empty TEST environment only

1. Create a brand-new empty test PostgreSQL database with the same server/version support, a separate private Supabase bucket, and a separate test-only application role.
2. Verify the clone's database name, host and `current_user` using `psql -X -c "select current_database(),current_user"`. Do not proceed if any value points to production/staging.
3. Configure `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSFILE`, `PGSSLMODE=verify-full` for that **test** database. Restore the dump:

```powershell
pg_restore --single-transaction --exit-on-error --no-owner --no-privileges -d $env:PGDATABASE D:\ParishBackups\parish-REPLACE_TIMESTAMP\parish.dump
```

4. Inspect Supabase **Storage → Buckets → test bucket**: public access disabled. Then set the isolated test variables `PARISH_RESTORE_TEST_BUCKET`, `PARISH_RESTORE_S3_ENDPOINT`, `PARISH_RESTORE_S3_REGION`, `PARISH_RESTORE_S3_ACCESS_KEY`, `PARISH_RESTORE_S3_SECRET_KEY`. Keep `PARISH_S3_BUCKET` set to the source bucket name so the tool refuses it as the destination.
5. Run the restore script first without `--apply`, then after manual review set `PARISH_RESTORE_TEST_BUCKET_PRIVATE_CONFIRMED=YES` and rerun with `--apply`:

```powershell
python scripts/restore_private_objects.py D:\ParishBackups\parish-REPLACE_TIMESTAMP
python scripts/restore_private_objects.py D:\ParishBackups\parish-REPLACE_TIMESTAMP --apply
```

6. Confirm all restored object hashes match the backup manifest; point a **test instance only** at the test database and bucket; verify an authorized document download, unrelated-user denial, certificate draft and report. Restore MFA encryption keys by separate secured operator procedure; do not copy secrets into the snapshot.
7. Record restoration date, operator, database/bucket identifiers privately, object counts, checksums, request access checks and screenshots in the Phase 8 evidence log.

## Before claiming durability

- In Main Admin → Digital Church Archives, check new storage warning. The server-side `/api/backend/api/archive/storage-status` must report `durable=true`.
- Upload fictional PDF/image in an isolated test instance, confirm its `parish_private.upload_object` index, restart the backend, open original scan and filled draft, and repeat from a separate instance.
- If upload index is empty or original files are missing: inventory the original disk with `python church_backend/sync_archive_storage.py` before `--apply` (requires same original file mount and configured private bucket).
- A status check or presigned URL alone does not prove the snapshot is complete. Backup and restoration are independent checks.

# Request identity rollout

The two names describe the requester, even when someone requests a certificate for a relative. New submissions require both. Earlier requests display “Not recorded” for missing names. The change retires personal mailing addresses from accounts and certificate requests. Parish office contact details and separately maintained cemetery contracts and archival documents keep their own data.

1. Back up the Supabase database. In the project's SQL Editor, run `deploy/migrations/20261127_request_identity.sql` before deploying. It adds two nullable columns to `parish_private.certificate_request`. Existing rows require no backfill.
2. Merge to the branch used by Render and deploy both `ifimarag` and `smart-parish-api` from the same revision. Wait for both services to be live before accepting new requests. Refresh tabs opened before the deployment.
3. With fictional data, submit a request with both parents’ names. Open its details as the requester. Search for either parent in the Staff and Admin certificate request queues. Check that Staff can process it and Admin can review it. Verify an older request still opens, a second parishioner sees only their own requests, and both report downloads open.
4. Once the updated services pass those checks, run `deploy/migrations/20261127_retire_personal_addresses.sql`. This permanently drops `parish_auth."User".address` and `parish_private.certificate_request.requester_address`. Keep the backup under the parish’s existing retention policy. Rolling back to a revision that reads the removed columns requires restoring those columns first.

The updated profile and request APIs omit the personal address as soon as the new services are running. No Render environment changes are required.

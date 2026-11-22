# Phase 8 — live certificate acceptance (synthetic data only)

**Never run write tests against the real parish database.** First confirm both Render services point to a disposable test PostgreSQL clone and private test bucket, and that the configured fee and email sender are test settings. Do not paste MFA secrets or cookies into GitHub or chat.

The order below is intentionally different from the requested prose: **a matching baptismal archive must exist before staff can approve membership**, because the application requires an exact baptismal certificate number.

| Step | Action | PASS | FAIL |
|---|---|---|---|
| 1 | Register two unique synthetic parishioners with privacy consent | HTTP 201; pending accounts; neither can access dashboard | Existing accounts changed or user logged in before approval |
| 2 | Verify both emails using inbox-delivered, single-use links | Verification succeeds; second token use denied | Email missing or token reusable |
| 3 | With Main Admin MFA, archive a fictional baptism scan and reviewed form data | OCR returns suggestions, staff corrects fields, saved archive record has immutable private original and filled PDF | Blank scan, upload 500, metadata unreviewed, file only on ephemeral disk |
| 4 | First parishioner submits a fictional ID and matching baptism certificate number | Pending evidence visible only to Main Admin | Evidence publicly accessible |
| 5 | Main Admin reviews original record and evidence, records reason and approves | Account approved; audit record created | Approved without matching record or staff review |
| 6 | Approved first parishioner signs in and requests a baptismal certificate | Request created, belongs to user 1, starts Pending | Other accounts can read it |
| 7 | Main Admin finds the matching archive record, selects it, approves request | Status transitions Pending → Approved; wrong office denied | Burial Admin can edit baptism request |
| 8 | Main Admin generates draft, checks details, uploads final signed/sealed fictional PDF | Draft and final PDF retrievable privately, request Ready | Draft mistaken for official issued certificate |
| 9 | Complete PayMongo **test** QR Ph checkout or record authorized test cash using the reviewed finance workflow | Provider verification and audit/ledger established; repeated signed event creates exactly one entry | UI return alone marks Paid; duplicates or unverifiable manual receipt |
| 10 | Staff releases the request and first parishioner downloads final document | Released + Paid and owner-only response | Early release or second parishioner download |
| 11 | Second signed-in parishioner tries `/api/backend/api/requests/<id>/download` and `/api/backend/files/uploads/baptismal/<random-scan-name>` | 403/404, no file bytes | Any 200 with private bytes |
| 12 | Restart test backend; repeat authorized file reads and checksum comparison | Originals and certificates survive restart | File was only on Render's ephemeral filesystem |

Use Chrome Network tab to record exact status codes and request IDs. Never disclose session tokens. A test-mode payment may be intentionally blocked from production release: use a **disposable test environment** to demonstrate the complete lifecycle and record the constraint rather than bypassing it.

## Local/offline negative authorization checks

```powershell
py -3.11 -m unittest tests.test_phase8_certificate_access -v
```

The isolated tests cover ownership and office checks in the real Flask handler function, **not** a live signed-in network journey. Test every row above against a disposable environment before claiming end-to-end completion.

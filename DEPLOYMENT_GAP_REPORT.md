# Deployment gap report — 2026-11-08

| Area | Verified in this package | Must still be verified on user's PC / host |
|---|---|---|
| OCR and template | Isolated Sofia scanned PNG -> Tesseract -> parser -> filled baptismal PDF passed; basic parser tests passed | Flask actual OCR endpoint and Save -> View flow, on Windows Tesseract PATH |
| Other templates | Baptismal and Confirmation generate 1-page PDF; Marriage generates 2-page PDF in isolated tests | OCR on representative Confirmation/Marriage source documents; printed alignment and legal field review |
| Flask | Syntax compilation; tested database upgrade against temporary SQLite | Real database migration, API workflow, WSGI process supervision, long-running reliability |
| Prisma | Historical mismatch identified and read-only diagnostic included | Baseline migration resolution and schema diff comparison on verified DB backup |
| Next.js | Changed TS/TSX transpile syntax checked | `npx tsc --noEmit`, `npm run build`, integration browser tests with actual project dependencies |
| Requests | Cancel/hide API routes added; ownership/status checks inspected | Multi-account role/access test, history UI, audit persistence |
| Archive data | Upload guards and staff review included, preserve primary PDF + original scan | Full upload and generated-file persistence across restarts/redeployments |
| Seeding | Hardcoded seed passwords removed; existing account passwords never reset by seed | Rotate previously exposed staff passwords, validate secure admin onboarding |
| Security | Generic 500 responses and comparison of backend shared key hardened | Application-level security review, CSRF/origin checks, upload/download tests, secret rotation, rate limits |
| Payments | Existing PayMongo sandbox tests only | PayMongo webhook signature/end-to-end confirmation; live mode NOT enabled |
| Cemetery | Existing Burial Admin map component present | Persistent map upload, external HTTPS availability, user/burial admin communication not built |
| Hosting | Deployment sequence documented; production mode prevents automatic schema mutation | VPS, HTTPS, backup restore, monitoring, storage sizing, privacy compliance and real workload testing |

**Release classification:** Staging/defense **candidate**; not approved for real parishioner production transactions. No guarantee of zero bugs.

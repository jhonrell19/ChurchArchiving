# Smart Parish — One-Page Capstone Test Evidence Log

**Staging revision:** __________ **Web / API live SHAs:** __________ / __________ **Evaluator:** __________

| Date/time (Asia/Manila) | Test | Steps / synthetic fixture | Expected result | Actual result | Pass / Fail | Evidence link or filename | Notes / defect ID |
|---|---|---|---|---|---|---|---|
| | Public calendar | Select event date; inspect published notice end date | Correct date, notice visible through final day | | | | |
| | Registration | Synthetic user, consent, email verification | Pending membership, verified email | | | | |
| | Membership | Staff review fictitious ID and matching baptism record | Approval + reason + audit | | | | |
| | Archive + OCR | Upload synthetic scan; review suggested fields | Original scan + filled PDF retrievable | | | | |
| | Request/release | Match source, staff approve, test payment, upload signed mock PDF | Correct states; only own released file downloadable | | | | |
| | Cross-user isolation | Second account opens owner request URL/scan URL | 403 or 404; never file bytes | | | | |
| | Office separation | Main accesses Burial; Burial accesses Main | 403 or 404 for unauthorized office | | | | |
| | PayMongo replay | Same signed test webhook twice | Exactly one verified ledger entry | | | | |
| | Twilio OTP | Approved test recipient, expired / wrong / valid OTP | Rate limits; valid code single-use | | | | |
| | Mass transcript | Imported fictional bilingual draft, corrected, saved/reopened | Transcript+summary persisted separately | | | | |
| | Restart/restore | Test bucket/object checksum and disposable DB restore | File persists after restart, checksum matches | | | | |
| | Accessibility | Mobile / keyboard / 200% zoom, older-user trial | Task success without coaching | | | | |

**Failures requiring immediate fix:** ___________________________________________________________

**Operator/evaluator sign-off:** ____________________  **Date:** ____________________

Privacy: use synthetic names only, redact cookies, provider references, passwords, phone numbers, record IDs and real personal data before attaching screenshots.

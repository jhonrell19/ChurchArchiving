# Browser-hosted Mass transcription (first release)

Status: DRAFT CODE IN REVIEW BRANCH — not merged or deployed.

## What works after approved rollout
- Super Admin selects a local authorized MP3/M4A/WAV/MP4/FLAC/OGG/WEBM recording **within the Smart Parish Mass Recordings screen**. No Python, faster-whisper, or desktop program is installed on that device.
- The authenticated Next.js web service streams the recording to Groq's hosted Whisper transcription API (`whisper-large-v3-turbo`), using the **transcriptions** endpoint, never translations. The server-only key remains in Render.
- Groq GPT-OSS 20B then attempts a staff-review summary of the **full returned transcript**, as long as it fits the prototype's 26,000-character summarization cap. If summary generation fails or input is longer, the full transcript remains in the editor and staff must write their own summary. We never pretend this fallback is AI summarization.
- The result fills the existing Summary / Full Transcript editor. NOTHING is automatically saved or released: Super Admin corrects and presses **Save Transcription & Summary** to use the current Flask -> Supabase persistence.
- Existing manual JSON import remains available in a collapsed optional panel for recovery.

## Limitations and next phase
- File size cap **23 MiB** for safety (Groq free tier currently publishes 25 MB per request).
- First release is an **interactive draft**: keep the browser open until completed. This is not yet a fault-tolerant transcription job queue and is not sufficient to promise full-length Mass video processing.
- Only a local uploaded recording is accepted by the transcription button. The website's unlisted YouTube link is for playback and cannot be blindly extracted as audio by Groq.
- Original-language multilingual ASR is attempted; short Tagalog-English switching, low-quality audio, proper nouns and homilies can still be misrecognized. Reviewer must correct against the recording.
- The computer/phone device does not install software, but it must have connectivity; Groq needs API availability and sufficient quota. A no-cost/free tier has quotas and is not guaranteed to remain available.
- For production-length Mass audio: next build a Supabase-backed job table, private recording references, controlled server-side audio compression and overlapping segments, retry/backoff, resume after timeout, per-segment status and progress polling. Use a managed processing service/paid external job runner, or provider-side hosted jobs. Do not perform heavy model inference on the Render free Flask instance.

## Required configuration
1. Get an API key from https://console.groq.com/keys . Do not send keys to ChatGPT, commit them to GitHub, or put them in NEXT_PUBLIC_* variables.
2. On Render **ifimarag** (Node/Next.js web service) -> Environment, add `GROQ_API_KEY` with the secret. No need to put this key on **smart-parish-api**.
3. Make sure `PARISH_SUPER_ADMIN_ID` is correctly configured and the merged account-role migrations are already applied; the route checks the privileged Super Admin role.
4. Merge this PR only after tests pass and the account migration has been stabilized. Deploy web revision only. No new DB migration is necessary for this first version.
5. Use a **fictional/authorized** 30–120-second mixed Tagalog-English recording smaller than 23 MiB. Log in as Super Admin, open Mass Recordings, expand a Mass, attach the file, confirm authorization and click **Transcribe Mass in Website**. Review generated fields, click Save, refresh, check the parishioner transcription view.
6. Confirm request does not freeze /api/ready or impact certificate workflows. Test invalid file, exceeding 23 MiB, missing/invalid API key, unauthorized STAFF session, quota/429, and timeout. Never disable access controls or publish incomplete transcripts for defense.

## Security
- Requires current authenticated Super Admin with matching `PARISH_SUPER_ADMIN_ID` and explicit recording authorization checkbox (client + server).
- The API key only exists on Render; it is never returned to clients.
- Request length and extension restricted; provider errors are not relayed; no draft is committed automatically.
- External transmission to a third-party AI processor must be disclosed in parish data privacy notice; obtain consent/authorization for any real recorded Mass or speaker audio and evaluate the provider's retention/data processing terms.
- Review publication is mandatory. Never include private sacramental documents or parishioner ID evidence in audio test files.

## Current endpoint
`POST /api/admin/masses/[id]/transcribe` with multipart parts `recording` and `authorized=yes`.
Returns `{ transcriptText, summaryText, summaryGenerated, draftOnly, message }`.

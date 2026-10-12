# Panel Revision Status

| Panel request | Status in this source pass |
|---|---|
| Revise Registration — more details + Login | Implemented: first/middle/surname, phone, address, email, password; DB sessions/role routing retained |
| Email Verification | Implemented in code; real delivery requires Resend/domain configuration |
| Data Validation | Implemented for registration/account fields and strengthened request/backend validation |
| Integrate AI | Faster-Whisper transcription retained and lazy-loaded; extractive summary improved |
| Upload scanned document -> extract text -> template | OCR preview/storage implemented; final official template generation requires parish-approved templates; safe draft PDF is available |
| Payment Method: QR Ph | Demo transaction state implemented; production PayMongo/QR Ph account/webhook activation documented |
| Improve UI | Light/cream/blue/navy/gold revision retained; missing slideshow image 404s removed; loading/error/empty states improved |
| Documentation — Objectives | Completion/testing/deployment documentation added and aligned to the six locked modules |

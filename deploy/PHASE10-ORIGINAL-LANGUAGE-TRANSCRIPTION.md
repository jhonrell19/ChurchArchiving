# Mass AI transcription: original spoken language (Tagalog + English)

## What this fixes

The old parish-PC transcription assistant used faster-whisper with automatic language detection only at the beginning of the recording and did not explicitly specify the decoding task. On recordings with a short English opening before a long Tagalog homily, the transcript could drift into English and paraphrase the Filipino speech.

**The updated assistant explicitly uses `task='transcribe'`, NOT `translate`.** Its recommended `--language auto` mode also enables per-segment language detection (`multilingual=True`, supported by faster-whisper 1.2.1). For mostly Tagalog homilies, `--language tl` is available if automatic detection misrecognizes Tagalog.

- **Full Transcript** contains the recognition of what the speaker said, preserving Tagalog, English, or Taglish; no deliberate English translation step.
- **Summary** is a separate, *extractive* offline draft: it selects original sentences from the transcript rather than generating fabricated or translated quotes. It is NOT a guaranteed accurate homily summary.
- Both fields must be **reviewed against the recording and edited by parish staff** before publishing.
- Whisper is automatic speech recognition, not court-grade verbatim transcription. Names, fillers, scripture quotations, and code-switching still need manual checking.
- No media is uploaded to a third-party AI API; processing runs on the parish PC. This remains suitable for a free Render web server.

## Windows 11 — first-time install

Use Python 3.11 (same family as the existing assistant). On the parish PC, open PowerShell from the repository directory:

```powershell
py -3.11 --version
py -3.11 -m pip install -r .\worker\requirements.txt
```

Or, if you downloaded only `mass_transcription_assistant.py` from the website:

```powershell
py -3.11 -m pip install faster-whisper==1.2.1 av==14.2.0
```

First use of a model downloads model weights once (internet needed for download). Afterwards the speech model is usable offline.

## Transcribe a Mass recording

The assistant transcribes an **actual local file** (.MP4, .MOV, .MP3, .M4A or .WAV). A YouTube link in the Mass Record does not contain downloadable recording bytes for the assistant. Use the original parish-owned audio recorded from the digital mixer or an authorized local video file.

From the repo:

```powershell
py -3.11 .\worker\transcribe.py "C:\Parish\Mass\Sunday-Mass.mp4" "C:\Parish\Mass\Sunday-Mass-draft.json" --language auto --model small
```

For a nearly all-Tagalog homily, try this if automatic detection converts Tagalog words into English:

```powershell
py -3.11 .\worker\transcribe.py "C:\Parish\Mass\Sunday-Mass.mp4" "C:\Parish\Mass\Sunday-Mass-Tagalog-draft.json" --language tl --model small
```

The output file path must be NEW; existing drafts are never overwritten.

For a graphical interface instead:

```powershell
py -3.11 .\worker\transcribe.py
```

Choose **Auto - Tagalog + English** or **Tagalog-dominant Mass**, pick the local recording, then save its new JSON draft. The `small` model is a practical accuracy/speed starting point; `base` is faster but less accurate, and `medium` can be slow on CPU.

## Import and publish

1. In the deployed parish website, log in as **Main Admin**.
2. Open **Mass Recordings**, add or select a Mass, click **Prepare transcript**.
3. Download and run the updated parish-PC assistant (or run the repo worker locally).
4. Import the generated `*-draft.json` in the expanded Mass form.
5. **Listen to the source recording** and verify names, Tagalog phrases, English phrases, dates, theology, and any omissions. Correct the Full Transcript and Summary **separately**.
6. Click **Save Transcription & Summary**. Only after this can the Mass legitimately be marked **Transcribed**. Other parishioners can then see the reviewed text in Transcriptions.

No paid transcription API, Oracle Cloud, Twilio or txtBee is needed for this local speech pipeline.

## Known limitations and troubleshooting

- **No one-click Render transcription:** `/api/masses/<id>/transcribe-ai` remains intentionally paused, because CPU-intensive synchronous speech jobs previously made the free Render API unresponsive. The assistant runs on the parish PC instead; this PR **does not reactivate** the dangerous cloud endpoint.
- **Not pure English output:** Choose auto or Tagalog-dominant; never change `task` to `translate`. Tagalog/English code-switching can still cause occasional mistranscriptions, requiring review.
- **Strong source audio matters:** Prefer mixer audio without music/echo; use a short sample to validate quality, then process the Mass.
- **Model size:** Try `--model small` first; for limited RAM/CPU use `--model base`. Small and medium may process slower than the recording's real-time length on old laptops. No guarantee of a processing duration.
- **Model download problem:** Internet is needed on first use, and the computer must have enough free disk/RAM.
- **Read-only test scope:** Automated tests use mocked speech model and fictional snippets. They prove the engine requests the correct task and preserves returned Tagalog/English text, not live accuracy or successful processing of a real homily.
- **Release order:** Merge this PR into `staging` after green CI, then deploy the merged `staging` to `ifimarag` (the helper is served from `public/`). If other commits since the prior deployment changed Flask, deploy `smart-parish-api` from the same `staging` too. Preserve environment secrets and Supabase data.

## Live evaluation proof

Record a fictional or consented 15–30-second test containing both languages, e.g. `Magandang umaga po, mga kapatid. Today we will talk about serving one another. Mahalaga ang pagmamahal sa kapwa.` Compare what was really spoken against the output JSON. The final draft must contain Tagalog and English phrasing, not only English paraphrases.

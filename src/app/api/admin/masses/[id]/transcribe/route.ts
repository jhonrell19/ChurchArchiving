import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'

// First release: browser -> authenticated Next.js -> hosted ASR -> review draft.
// The Flask service does not run Whisper. Nothing is published or written
// automatically; the existing reviewed transcription PATCH remains authoritative.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_AUDIO = 23 * 1024 * 1024
const ALLOWED = new Set(['mp3', 'wav', 'm4a', 'mp4', 'flac', 'ogg', 'webm', 'mpeg', 'mpga'])

function json(payload: object, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

async function createAISummary(transcript: string, key: string): Promise<string | null> {
  // For long transcripts, don't quietly summarize an incomplete excerpt.
  // The user can still correct the full transcript and write a manual summary.
  if (transcript.length > 26000) return null
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        reasoning_effort: 'low',
        temperature: 0.1,
        max_completion_tokens: 1100,
        messages: [
          {
            role: 'system',
            content: 'You are drafting a factual summary for church staff to review. Summarize ONLY the supplied transcript, without inventing events, Bible verses, names or quotations. Use concise paragraphs with key homily themes. Preserve Tagalog/English as actually used and do not translate the entire content into English. Do not mistake prayers for sermon claims. No introductory disclaimers.',
          },
          { role: 'user', content: transcript },
        ],
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('choices' in payload)) return null
    const first = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]
    const summary = first?.message?.content
    return typeof summary === 'string' && summary.trim().length > 0
      ? summary.trim().slice(0, 50000) : null
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!isSupervisor(user)) return json({ error: 'Super Admin access required.' }, 403)

  const { id } = await params
  const massId = Number(id)
  if (!Number.isSafeInteger(massId) || massId < 1)
    return json({ error: 'Invalid Mass record.' }, 400)

  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) return json({ error: 'Cloud transcription is not configured. Ask the administrator to set the server-only GROQ_API_KEY.' }, 503)

  // Do not buffer an obviously oversized request.
  const sizeHeader = Number(request.headers.get('content-length') || '0')
  if (sizeHeader > MAX_AUDIO + 64 * 1024)
    return json({ error: 'Choose an audio file smaller than 23 MB. Larger Masses will need the queued/chunked workflow.' }, 413)

  try {
    const form = await request.formData()
    const recording = form.get('recording')
    if (!(recording instanceof File) || !recording.size)
      return json({ error: 'Choose a recorded Mass file.' }, 400)
    if (form.get('authorized') !== 'yes')
      return json({ error: 'Confirm that this recording is authorized for external AI processing.' }, 400)

    const ext = recording.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED.has(ext) || recording.size > MAX_AUDIO)
      return json({ error: 'Supported audio/video: MP3, WAV, M4A, MP4, FLAC, OGG, WEBM, MPEG, up to 23 MB.' }, 413)

    // Never ask Groq to translate. Keep language automatic for mixed speech.
    const upstreamForm = new FormData()
    upstreamForm.append('file', recording, recording.name.slice(-125))
    upstreamForm.append('model', 'whisper-large-v3-turbo')
    upstreamForm.append('response_format', 'verbose_json')
    upstreamForm.append('temperature', '0')
    upstreamForm.append('prompt', 'Iglesia Filipina Independiente. Homiliya, misa, panalangin. Spoken Tagalog, Filipino and English. Preserve speech in its original language.')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: upstreamForm,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(110_000),
    })

    if (!response.ok) {
      // Provider errors can include user or account metadata; never relay them.
      if (response.status === 429)
        return json({ error: 'AI provider rate limit reached. Try again when the account quota resets.' }, 429)
      if (response.status === 413)
        return json({ error: 'Provider rejected the audio size. Use a shorter or smaller recording.' }, 413)
      return json({ error: 'Cloud speech recognition failed. Check provider access, file format and Render logs.' }, 502)
    }

    const payload: unknown = await response.json()
    const text = payload && typeof payload === 'object' && 'text' in payload
      ? (payload as { text?: unknown }).text : undefined
    if (typeof text !== 'string' || !text.trim())
      return json({ error: 'No recognizable speech was returned. Check the recording.' }, 422)
    if (text.length > 500000)
      return json({ error: 'Transcript is too long for the current editor. Use shorter recordings.' }, 413)

    const transcriptText = text.trim()
    const summary = await createAISummary(transcriptText, key)
    return json({
      massId,
      transcriptText,
      summaryText: summary || '',
      summaryGenerated: Boolean(summary),
      draftOnly: true,
      message: summary
        ? 'Cloud transcript and AI summary ready for your review. Nothing has been published.'
        : 'Cloud transcript ready. Automatic summary is unavailable; review the transcript and enter a summary before saving.',
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
      return json({ error: 'Cloud transcription timed out. Try a shorter audio file. No Mass record was modified.' }, 504)
    console.warn('Cloud Mass draft failed without modifying an archive record.')
    return json({ error: 'Could not create a transcript draft. Try a supported recording.' }, 502)
  }
}

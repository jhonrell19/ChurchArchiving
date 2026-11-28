'use client'

import { useEffect } from 'react'

type Props = { title: string; filepath: string; transcript?: string | null; summary?: string | null; onClose: () => void }
export default function MassMediaPlayer({title, filepath, transcript, summary, onClose}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // URLs from the API must still be allowlisted here before becoming iframe sources.
  const videoId = (() => {
    try {
      const url = new URL(filepath)
      if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || url.pathname !== '/watch') return null
      const id = url.searchParams.get('v')
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    } catch { return null }
  })()
  const source = '/api/backend/files/' + filepath.split('/').map(encodeURIComponent).join('/')
  const isAudio = /\.(mp3|m4a|wav|ogg|aac|flac|opus|wma)$/i.test(filepath)
  return (
    <div role="dialog" aria-modal="true" aria-label={`Playing ${title}`} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-h-[90dvh] overflow-y-auto w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-black text-xl truncate">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-200 px-4 py-2 text-black" aria-label="Close media player">Close ✕</button>
        </div>
        {videoId
          ? <iframe key={videoId} title={`YouTube Homily: ${title}`}
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              className="aspect-video w-full rounded-lg bg-black"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          : isAudio
            ? <audio key={source} controls autoPlay className="w-full" src={source}>Your browser cannot play this audio.</audio>
            : <video key={source} controls autoPlay playsInline preload="metadata" className="w-full max-h-[70vh] bg-black rounded-lg" src={source}>Your browser cannot play this video.</video>}
        {(summary !== undefined || transcript !== undefined) && <section className="space-y-2 py-3"><h3 className="font-semibold">Summary</h3>
          <p className="whitespace-pre-wrap">{summary || 'No summary available.'}</p>
          <h3 className="font-semibold">Transcription</h3><p className="whitespace-pre-wrap">{transcript || 'No transcription available.'}</p>
        </section>}
        <p className="mt-2 text-sm text-slate-600">If playback fails, check that the YouTube video allows embedding, or verify the private media file exists.</p>
      </div>
    </div>
  )
}

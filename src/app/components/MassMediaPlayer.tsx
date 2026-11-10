'use client'

import { useEffect } from 'react'

type Props = { title: string; filepath: string; onClose: () => void }
export default function MassMediaPlayer({title, filepath, onClose}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const source = '/api/backend/files/' + filepath.split('/').map(encodeURIComponent).join('/')
  const isAudio = /\.(mp3|m4a|wav|ogg|aac|flac|opus|wma)$/i.test(filepath)
  return (
    <div role="dialog" aria-modal="true" aria-label={`Playing ${title}`} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-black text-xl truncate">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-200 px-4 py-2 text-black" aria-label="Close media player">Close ✕</button>
        </div>
        {isAudio ? <audio key={source} controls autoPlay className="w-full" src={source}>Your browser cannot play this audio.</audio> : <video key={source} controls autoPlay playsInline preload="metadata" className="w-full max-h-[70vh] bg-black rounded-lg" src={source}>Your browser cannot play this video.</video>}
        <p className="mt-2 text-sm text-slate-600">If playback fails, verify the file exists and is a browser-supported video/audio format (MP4 H.264/AAC is recommended).</p>
      </div>
    </div>
  )
}

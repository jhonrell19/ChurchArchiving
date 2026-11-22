'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Tone = 'success' | 'error' | 'warning' | 'info'
type Toast = { id: number; message: string; tone: Tone }
type ConfirmOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}
type PendingConfirmation = ConfirmOptions & {
  message: string
  resolve: (accepted: boolean) => void
}
type FeedbackContextValue = {
  toast: Record<Tone, (message: string) => void>
  confirmAction: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const STYLES: Record<Tone, { border: string; symbol: string; title: string }> = {
  success: { border: 'border-emerald-300 bg-emerald-50 text-emerald-950', symbol: '✓', title: 'Success' },
  error: { border: 'border-rose-300 bg-rose-50 text-rose-950', symbol: '!', title: 'Action needed' },
  warning: { border: 'border-amber-300 bg-amber-50 text-amber-950', symbol: '!', title: 'Please review' },
  info: { border: 'border-sky-300 bg-sky-50 text-sky-950', symbol: 'i', title: 'Notice' },
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Toast[]>([])
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null)
  const sequence = useRef(0)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const pending = useRef<PendingConfirmation | null>(null)
  const cancelButton = useRef<HTMLButtonElement | null>(null)
  const confirmButton = useRef<HTMLButtonElement | null>(null)
  const originalFocus = useRef<HTMLElement | null>(null)

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setMessages(previous => previous.filter(item => item.id !== id))
  }, [])

  const push = useCallback((message: string, tone: Tone) => {
    if (typeof message !== 'string' || !message.trim()) return
    const id = ++sequence.current
    setMessages(previous => [...previous.slice(-3), { id, message: message.trim(), tone }])
    timers.current.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 10000 : 6500))
  }, [dismiss])

  const toast = useMemo<FeedbackContextValue['toast']>(() => ({
    success: message => push(message, 'success'),
    error: message => push(message, 'error'),
    warning: message => push(message, 'warning'),
    info: message => push(message, 'info'),
  }), [push])

  const finishConfirmation = useCallback((accepted: boolean) => {
    const active = pending.current
    pending.current = null
    setConfirmation(null)
    active?.resolve(accepted)
    originalFocus.current?.focus()
  }, [])

  const confirmAction = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>(resolve => {
      // Never leave an earlier caller waiting if two actions compete for a dialog.
      if (pending.current) pending.current.resolve(false)
      originalFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const next = { ...options, message, resolve }
      pending.current = next
      setConfirmation(next)
    })
  }, [])

  useEffect(() => {
    return () => {
      timers.current.forEach(timer => clearTimeout(timer))
      timers.current.clear()
      pending.current?.resolve(false)
      pending.current = null
    }
  }, [])

  useEffect(() => {
    if (!confirmation) return
    cancelButton.current?.focus()
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finishConfirmation(false)
        return
      }
      if (event.key !== 'Tab') return
      // Keep keyboard navigation inside the confirmation dialog.
      const first = cancelButton.current
      const last = confirmButton.current
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [confirmation, finishConfirmation])

  const value = useMemo(() => ({ toast, confirmAction }), [toast, confirmAction])
  const destructive = confirmation?.tone === 'danger' ||
    /\b(delete|remove|reject|cancel|discard|reversal)\b/i.test(confirmation?.message || '')

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[1200] flex w-[min(420px,calc(100vw-24px))] flex-col gap-3 sm:right-5 sm:top-5" aria-label="System notifications">
        {messages.map(item => {
          const style = STYLES[item.tone]
          return (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-xl ${style.border}`}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 font-bold">
                  {style.symbol}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">{style.title}</p>
                  <p className="mt-1 break-words text-[15px] leading-relaxed">{item.message}</p>
                </div>
                <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"
                  className="min-h-9 min-w-9 shrink-0 rounded-lg text-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2">
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="parish-confirm-title"
            aria-describedby="parish-confirm-message"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <h2 id="parish-confirm-title" className="text-xl font-bold">
              {confirmation.title || (destructive ? 'Confirm this action' : 'Please confirm')}
            </h2>
            <p id="parish-confirm-message" className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">
              {confirmation.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                ref={cancelButton}
                type="button"
                onClick={() => finishConfirmation(false)}
                className="min-h-11 rounded-xl border border-slate-300 px-5 py-2.5 text-base font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {confirmation.cancelLabel || 'Cancel'}
              </button>
              <button
                ref={confirmButton}
                type="button"
                onClick={() => finishConfirmation(true)}
                className={`min-h-11 rounded-xl px-5 py-2.5 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${destructive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-800 hover:bg-emerald-900'}`}
              >
                {confirmation.confirmLabel || (destructive ? 'Confirm action' : 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider')
  return context
}

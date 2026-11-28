'use client'

import { useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { isTestCertificatePayment } from '@/lib/certificatePayment'

type Props = {
  requestId: number
  status: string
  paymentStatus: string
  paymentMethod: string | null
  onSaved: () => Promise<void>
}

/** Removes ONLY the release eligibility of a known sandbox payment.
 * It never creates money, erases a historical transaction, or releases a file.
 */
export default function TestPaymentReconciliationPanel({
  requestId, status, paymentStatus, paymentMethod, onSaved,
}: Props) {
  const { toast, confirmAction } = useFeedback()
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)

  const hasTestPayment = paymentStatus === 'Paid' &&
    (paymentMethod === 'PAYMONGO_TEST' || paymentMethod === 'DEMO') &&
    isTestCertificatePayment(paymentMethod)
  if (!hasTestPayment || !['Approved', 'Ready'].includes(status)) return null

  const reconcile = async () => {
    const explanation = reason.trim()
    if (!acknowledged || explanation.length < 10 || explanation.length > 500) {
      toast.warning('Confirm no actual funds were received and enter a reason of 10–500 characters.')
      return
    }
    const confirmed = await confirmAction(
      'Reconcile this TEST-ONLY payment? This keeps the original simulated payment in the audit history, removes its Paid eligibility and requires a genuine office cash receipt before official release.'
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const response = await fetch(`/api/backend/api/requests/${requestId}/reconcile-test-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acknowledgement: 'NO_REAL_FUNDS_RECEIVED',
          reason: explanation,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.ok !== true) {
        toast.error(result?.error || result?.message || 'Test payment could not be reconciled.')
        return
      }
      setAcknowledged(false)
      setReason('')
      await onSaved()
      toast.success('Sandbox payment reconciled. No real funds were received; collect verified cash before release.')
    } catch {
      toast.error('Reconciliation result is uncertain. Refresh the request and inspect the payment status before retrying.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Reconcile simulated payment"
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-amber-950">Resolve previous PayMongo test payment</h4>
      <p className="text-sm text-amber-950">
        The request was marked Paid by a sandbox simulation, not a real collection.
        This action preserves the test's audit trail and sets the active payment back to Unpaid.
        It does NOT release the document or substitute for money received at the parish office.
      </p>
      <label className="flex items-start gap-2 text-sm text-amber-950">
        <input type="checkbox" checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)}
          className="mt-1 size-4 shrink-0" />
        I verified this was a test-only transaction and no real money was received.
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-amber-950">
        Audit explanation (10–500 characters)
        <textarea rows={2} maxLength={500} value={reason}
          onChange={event => setReason(event.target.value)}
          placeholder="Sandbox payment used for testing; no actual payment was collected."
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-base" />
      </label>
      <button type="button" disabled={busy || !acknowledged || reason.trim().length < 10}
        onClick={() => void reconcile()}
        className="min-h-11 rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? 'Reconciling…' : 'Reconcile test payment — no real funds'}
      </button>
    </section>
  )
}

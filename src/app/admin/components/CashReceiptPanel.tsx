'use client'

import { useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'

type Props = {
  requestId: number
  status: string
  paymentStatus: string
  paymentMethod: string | null
  totalFee: number
  onSaved: () => Promise<void>
}

const validReference = /^[A-Z0-9][A-Z0-9-]{5,63}$/

/** Records real money handed to the authorized parish cashier.
 * Never records screenshots, gateway simulations or unverified transfers as cash.
 * The Flask endpoint is the authoritative ledger and checks roles, fee,
 * request status, duplicate receipts, and reversal eligibility.
 */
export default function CashReceiptPanel({
  requestId, status, paymentStatus, paymentMethod, totalFee, onSaved,
}: Props) {
  const { toast, confirmAction } = useFeedback()
  const [receiptNumber, setReceiptNumber] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const cashPaid = paymentStatus === 'Paid' && paymentMethod === 'CASH'
  const unpaid = paymentStatus !== 'Paid'
  const permittedStatus = status === 'Approved' || status === 'Ready'

  if (!permittedStatus || (!unpaid && !cashPaid)) return null

  const action = cashPaid ? 'reverse' : 'record'
  const submit = async () => {
    const reference = receiptNumber.trim().toUpperCase()
    const notes = reason.trim()
    if (!validReference.test(reference)) {
      toast.warning('Enter a valid, unique official receipt/reference number (6–64 letters, digits or hyphens).')
      return
    }
    if (notes.length < 5 || notes.length > 500) {
      toast.warning('Enter a payment or reversal explanation of 5–500 characters.')
      return
    }
    const message = cashPaid
      ? 'Reverse this recorded cash payment? A permanent reversal entry will be written; it will not delete the original receipt. Only proceed with an approved correction.'
      : 'Confirm the authorized parish cashier has physically RECEIVED the full amount and issued this genuine official receipt? A screenshot or PayMongo test transaction is not proof of cash.'
    if (!(await confirmAction(message))) return

    setBusy(true)
    try {
      const response = await fetch(`/api/backend/api/requests/${requestId}/cash-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, receiptNumber: reference, reason: notes }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.ok !== true) {
        toast.error(result?.error || result?.message ||
          'Could not record the receipt. Confirm the cash ledger is enabled and its migration is applied.')
        return
      }
      setReceiptNumber('')
      setReason('')
      await onSaved()
      toast.success(cashPaid
        ? 'Cash receipt reversed with an auditable entry. The request now requires payment.'
        : 'Actual parish-office cash payment recorded with its official receipt.')
    } catch {
      toast.error('Cash receipt status is uncertain. Refresh the request before attempting it again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3"
      aria-label="Official parish cash receipt">
      <h4 className="text-base font-semibold text-slate-900">
        {cashPaid ? 'Correct an official cash receipt' : 'Record actual cash collected at the parish office'}
      </h4>
      <p className="text-sm text-slate-700">
        {cashPaid
          ? 'A correction creates a separate reversal audit entry. The original payment record remains on file.'
          : 'Only authorized staff may record money physically received by the parish cashier. Do not record a test checkout, promised payment, personal-wallet transfer or screenshot as cash.'}
      </p>
      <p className="text-sm font-semibold text-slate-800">
        {cashPaid ? 'Existing receipt: ' + (paymentMethod || 'CASH') + ' (see payment tracking)' :
          'Full amount due: ₱' + Number(totalFee || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          {cashPaid ? 'New correction reference' : 'Official cash receipt number'}
          <input
            type="text" required maxLength={64} autoComplete="off"
            value={receiptNumber}
            onChange={e => setReceiptNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            placeholder={cashPaid ? 'REV-000001' : 'OR-000001'}
            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          {cashPaid ? 'Reason for reversal' : 'Collection details / reason'}
          <textarea required rows={2} maxLength={500} value={reason}
            onChange={e => setReason(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            placeholder={cashPaid ? 'Reason for authorized correction' : 'Cash received by parish office and receipt issued'} />
        </label>
      </div>
      <button type="button" onClick={() => void submit()} disabled={busy || (!cashPaid && totalFee <= 0)}
        className={`min-h-11 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50 ${cashPaid ? 'bg-amber-800' : 'bg-emerald-800'}`}>
        {busy ? 'Saving receipt…' : cashPaid ? 'Record audited cash reversal' : 'Record verified cash payment'}
      </button>
      <p className="text-xs text-slate-600">
        A cashier's physical collection is required. The system records payment but does not receive, store, or transfer money itself.
      </p>
    </section>
  )
}

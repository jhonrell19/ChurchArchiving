'use client'

import { isConfirmedCertificatePayment, isTestCertificatePayment } from '@/lib/certificatePayment'

/**
 * The request API is the sole source of truth. This component derives milestones
 * from persisted request status; it does NOT invent historical transition dates,
 * SMS deliveries, or a physical collection event.
 */
export type RequestWorkflowStep = 'submitted' | 'verify' | 'prepare' | 'release'

export type TrackingRequest = {
  id: number
  status: string
  paymentStatus: string
  paymentMethod?: string | null
  paymentReference?: string | null
  paidAt?: string | null
  totalFee?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  generatedFile?: string | null
  matchedDocumentId?: number | null
  remarks?: string | null
}

const formatPhp = (amount?: number | null) =>
  '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatManilaTime = (value?: string | null): string | null => {
  if (!value) return null
  // Flask stores UTC-naive timestamps; interpreting them as browser-local would
  // show different results on the staff and parishioner devices.
  const raw = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z'
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date) + ' PHT'
}

const badge = (done: boolean, current: boolean) =>
  done ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : current ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-slate-200 bg-slate-50 text-slate-600'

export default function RequestTracking({
  request,
  compact = false,
  paymentOnly = false,
  selectedStep = null,
  onStepSelect,
}: {
  request: TrackingRequest
  compact?: boolean
  /** Staff workflow: show payment details only when the Release stage is opened. */
  paymentOnly?: boolean
  /** Staff workflow: make the four colored milestones the actual navigation. */
  selectedStep?: RequestWorkflowStep | null
  onStepSelect?: (step: RequestWorkflowStep) => void
}) {
  const status = request.status || 'Pending'
  const stopped = status === 'Rejected' || status === 'Cancelled'
  const approved = ['Approved', 'Ready', 'Released'].includes(status)
  const prepared = ['Ready', 'Released'].includes(status) && !!request.generatedFile
  const released = status === 'Released'
  const method = request.paymentMethod || ''
  const isSandbox = isTestCertificatePayment(method)
  const recordedTestPayment = request.paymentStatus === 'Paid' && isSandbox
  const paid = isConfirmedCertificatePayment(request.paymentStatus, method)
  const checkoutPending = method.startsWith('PAYMONGO_') && method.endsWith('_PENDING') && !paid
  const reversed = method === 'CASH_REVERSED'
  const steps = [
    { key: 'submitted' as const, name: 'Request submitted', done: true, detail: 'Open Account information & Requested information tables' },
    { key: 'verify' as const, name: 'Staff verification', done: approved, detail: 'Verify the matching record and approve or reject' },
    { key: 'prepare' as const, name: 'Document prepared', done: prepared, detail: 'Generate, review and attach the final document' },
    { key: 'release' as const, name: 'Office release', done: released, detail: 'Check payment and history, then release when eligible' },
  ]
  const nextIndex = steps.findIndex(step => !step.done)
  const paymentLabel = recordedTestPayment
    ? 'Test payment recorded — no real funds collected'
    : paid ? 'Payment confirmed'
    : reversed ? 'Cash receipt reversed — payment required'
      : checkoutPending ? 'Checkout started — awaiting verified payment'
        : 'Payment not yet confirmed'
  const paymentType = method === 'CASH' ? 'Cash recorded by staff'
    : isSandbox ? 'PayMongo sandbox / demonstration'
      : method === 'PAYMONGO_LIVE' ? 'PayMongo verified online'
        : checkoutPending ? 'PayMongo checkout initiated'
          : reversed ? 'Cash receipt reversed'
            : 'No verified payment method yet'
  const nextAction = stopped
    ? status === 'Rejected'
      ? 'This request was declined. Contact the parish office for details or a new request.'
      : 'This request was cancelled. The audit and payment records remain on file.'
    : recordedTestPayment
      ? 'Only a simulated payment is recorded. No real funds were received, so the parish cannot release this certificate. Contact staff to reconcile the request and arrange a verified live payment or official receipt; do not retry payment until they confirm.'
    : released
      ? 'Release has been recorded. Arrange collection of the official signed copy with the parish office; online release is not proof of physical pickup.'
      : status === 'Ready'
        ? paid
          ? 'The document is prepared and payment is confirmed. Await staff release and parish pickup instructions.'
          : 'The document is prepared, but payment has not been confirmed. Coordinate payment with the parish office.'
        : status === 'Approved'
          ? paid
            ? 'Payment is confirmed. Parish staff must prepare and review the final document.'
            : 'Your request was approved. Complete the applicable payment or coordinate with parish staff.'
          : 'Waiting for parish staff to verify your request and the correct sacramental record.'

  if (onStepSelect) {
    return (
      <nav aria-label={`Certificate workflow for IFI-REQ-${String(request.id).padStart(4, '0')}`}>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const isCurrent = !stopped && index === nextIndex
            const isSelected = selectedStep === step.key
            return (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => onStepSelect(step.key)}
                  aria-expanded={isSelected}
                  aria-controls={step.key === 'submitted' ? `staff-request-details-${request.id}` : `staff-workflow-panel-${request.id}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-h-40 w-full flex-col rounded-xl border-2 p-4 text-left transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${badge(step.done, isCurrent)} ${isSelected ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
                >
                  <span className="flex items-center gap-2 text-base font-semibold">
                    <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-current/30 text-sm font-bold">
                      {step.done ? '✓' : index + 1}
                    </span>
                    {step.name}
                  </span>
                  <span className="mt-2 text-sm leading-relaxed">{step.detail}</span>
                  <span className="mt-auto pt-3 text-sm font-semibold">
                    {isSelected ? 'Close this step ↑' : step.done ? 'Completed · Open step →' : isCurrent ? 'Current step · Open →' : 'View step →'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    )
  }

  return (
    <section aria-label={`Tracking for request IFI-REQ-${String(request.id).padStart(4, '0')}`}
      className="rounded-xl border border-emerald-200 bg-white p-4 sm:p-5">
      {!paymentOnly && <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Request &amp; payment tracking</h3>
          <p className="mt-1 text-sm text-slate-600">
            Reference: <span className="font-semibold">IFI-REQ-{String(request.id).padStart(4, '0')}</span>
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${stopped ? 'border-rose-200 bg-rose-50 text-rose-800' : released ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          {status}
        </span>
      </div>}

      {!paymentOnly && <ol className={`mt-4 grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {steps.map((step, index) => {
          const isCurrent = !stopped && index === nextIndex
          return (
            <li key={step.name} aria-current={isCurrent ? 'step' : undefined}
              className={`rounded-lg border p-3 ${badge(step.done, isCurrent)}`}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/30 text-sm font-bold">
                  {step.done ? '✓' : index + 1}
                </span>
                <span className="text-sm font-semibold">{step.name}</span>
              </div>
              {!compact && <p className="mt-2 text-sm leading-relaxed">{step.detail}</p>}
              <p className="mt-1 text-xs font-medium">
                {step.done ? 'Recorded' : isCurrent ? 'Current stage' : stopped ? 'Not completed' : 'Awaiting'}
              </p>
            </li>
          )
        })}
      </ol>}

      {stopped && !paymentOnly && <div role="status" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
        Request {status.toLowerCase()}. Previous completed stages cannot be reconstructed from the current status alone.
      </div>}

      <div className={`${paymentOnly ? '' : 'mt-4'} grid gap-3 md:grid-cols-2`}>
        <section aria-label="Payment verification" className={`rounded-lg border p-4 ${paid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <h4 className="text-base font-semibold text-slate-900">Payment tracking</h4>
          <p className="mt-1 text-sm font-semibold text-slate-900">{paymentLabel}</p>
          <dl className="mt-2 space-y-1.5 text-sm text-slate-700">
            <div className="flex flex-wrap justify-between gap-x-2"><dt>Amount due</dt><dd className="font-semibold">{formatPhp(request.totalFee)}</dd></div>
            <div className="flex flex-wrap justify-between gap-x-2"><dt>Method</dt><dd className="font-medium">{paymentType}</dd></div>
            {request.paymentReference && (
              <div><dt className="font-medium">Payment / checkout reference</dt><dd className="break-all font-mono text-xs">{request.paymentReference}</dd></div>
            )}
            {(paid || recordedTestPayment) && request.paidAt && (
              <div><dt className="font-medium">{recordedTestPayment ? 'Recorded test transaction date' : 'Recorded payment date'}</dt><dd>{formatManilaTime(request.paidAt)}</dd></div>
            )}
          </dl>
          {isSandbox && <p className="mt-2 text-sm font-semibold text-amber-900">
            Sandbox only — not proof of real money received.
          </p>}
          {!paid && Number(request.totalFee || 0) === 0 && <p className="mt-2 text-xs text-slate-700">
            No fee configured. Staff must confirm applicable payment or waiver before release.
          </p>}
        </section>
        <section aria-label="Next action" className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-slate-900">What happens next?</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{nextAction}</p>
          {request.remarks && !compact && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Latest staff remarks</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{request.remarks}</p>
            </div>
          )}
        </section>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Submitted: {formatManilaTime(request.createdAt) || 'Date unavailable'}.
        {request.updatedAt ? ` Latest record update: ${formatManilaTime(request.updatedAt)}.` : ''}
        {' '}Only submission, last-update and payment timestamps are available; earlier stage times are not claimed.
      </p>
    </section>
  )
}

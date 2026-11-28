'use client'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import RequestDetails from '@/components/RequestDetails'
import RequestTracking, { type RequestWorkflowStep } from '@/components/RequestTracking'
import { isConfirmedCertificatePayment, isTestCertificatePayment } from '@/lib/certificatePayment'
import NotificationOutboxControl from './NotificationOutboxControl'

import { useEffect, useRef, useState } from 'react'
import { CERT_ICONS } from '../data/ui'

type ReqStatus = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Ready' | 'Released'

type ArchiveDocument = {
  id: number
  personName: string
  sacramentType: string
  parish: string | null
  priest: string | null
  dateOfRecord: string | null
  certificateNumber: string | null
  documentType: string | null
  filename: string | null
  filepath: string
  bookNumber?: string | null
  pageNumber?: string | null
}

type CertificateRequest = {
  id: number
  identity?:Record<string,string|boolean>
  history?: {status:string;at:string}[]
  requesterUserId: number | null
  requesterName: string
  requesterEmail: string
  contactNumber: string
  motherFullName: string | null
  fatherFullName: string | null
  sacramentType: string
  personName: string
  purpose: string
  recordDateHint: string | null
  recordDetails: string | null
  isUrgent: boolean
  baseFee: number
  urgentFee: number
  totalFee: number
  paymentStatus: string
  paymentMethod: string | null
  paymentReference: string | null
  paidAt: string | null
  status: string
  remarks: string | null
  matchedDocumentId: number | null
  matchedDocument: ArchiveDocument | null
  draftFile: string | null
  generatedFile: string | null
  createdAt: string | null
  updatedAt: string | null
}

type Props = {
  readOnly?: boolean
  urgentOnly?: boolean
  office?: 'main' | 'burial'
}

const FILTERS: ReqStatus[] = ['All', 'Pending', 'Approved', 'Ready', 'Released', 'Rejected']

const toDisplayType = (type: string) => {
  switch (type) {
    case 'baptismal':
      return 'Baptismal'
    case 'confirmation':
      return 'Confirmation'
    case 'marriage':
      return 'Marriage'
    case 'ownership':
      return 'Certificate of Ownership'
    case 'burial':
    case 'death':
      return 'Historical Burial Request'
    case 'land_agreement':
      return 'Land Agreement'
    default:
      return type
  }
}

const getRequestIcon = (type: string) =>
  CERT_ICONS[toDisplayType(type)] || CERT_ICONS[type] || 'ti-file-certificate'

const formatPeso = (amount: number | null | undefined) =>
  `₱${Number(amount || 0).toLocaleString('en-PH')}`

const backendFileUrl = (filepath: string) => {
  const normalized = filepath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  return `/api/backend/files/${encoded}`
}

const releaseFileName = (filepath: string | null) => {
  if (!filepath) return 'No final document uploaded'
  const normalized = filepath.replace(/\\/g, '/')
  return normalized.split('/').pop() || 'Release document'
}

export default function RequestsPage({ urgentOnly = false, office = 'main', readOnly = false }: Props) {
  const { toast, confirmAction } = useFeedback()
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [filter, setFilter] = useState<ReqStatus>('All')
  const [activeStep, setActiveStep] = useState<{ requestId: number; step: RequestWorkflowStep } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [searchingId, setSearchingId] = useState<number | null>(null)
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({})
  const [searchResults, setSearchResults] = useState<Record<number, ArchiveDocument[]>>({})
  const [releaseFiles, setReleaseFiles] = useState<Record<number, File | null>>({})

  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [pages, setPages] = useState(1)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loadError, setLoadError] = useState(false)
  const serial = useRef(0)
  const loadRequests = async () => {
    const revision = ++serial.current
    setLoadError(false)
    try {
      setLoading(true)
      const priority = urgentOnly ? 'urgent' : 'all'
      const res = await fetch(`/api/backend/api/requests?priority=${priority}&page=${page}&status=${encodeURIComponent(filter)}&q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load requests')
      }

      if (revision !== serial.current) return
      setPage(data.page)
      setPages(data.pages)
      setCounts(data.counts)
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      if (revision !== serial.current) return
      setLoadError(true)
      console.warn('Load requests error:', err)
      setRequests([])
    } finally {
      if (revision === serial.current) setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadRequests())
    return () => { serial.current++ }
  }, [urgentOnly, page, filter, query])

  const searchArchive = async (item: CertificateRequest) => {
    const query = (searchTerms[item.id] ?? item.personName).trim()

    if (!query) {
      toast.warning('Enter a name to search for.')
      return
    }

    try {
      setSearchingId(item.id)
      const categories = item.sacramentType === 'ownership'
        ? ['ownership', 'land_agreement']
        : [item.sacramentType]
      const results = await Promise.all(categories.map(async category => {
        const res = await fetch(
          `/api/backend/api/archive/documents/${encodeURIComponent(category)}?q=${encodeURIComponent(query)}`,
          { cache: 'no-store' }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to search the archive.')
        return Array.isArray(data.documents) ? (data.documents as ArchiveDocument[]) : []
      }))
      const unique = new Map<number, ArchiveDocument>()
      for (const record of results.flat()) unique.set(record.id, record)
      setSearchResults(prev => ({
        ...prev,
        [item.id]: Array.from(unique.values()),
      }))
    } catch (error) {
      console.warn('Archive search error:', error)
      toast.error('Unable to search the archive right now.')
    } finally {
      setSearchingId(null)
    }
  }

  const selectSourceRecord = async (item: CertificateRequest, document: ArchiveDocument) => {
    const confirmed = await confirmAction(
      `Use ${document.personName} (${document.certificateNumber || `Archive #${document.id}`}) as the verified source record for this request?`
    )

    if (!confirmed) return

    try {
      setBusyId(item.id)
      const res = await fetch(`/api/backend/api/requests/${item.id}/select-record`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || data.message || 'Unable to select this archive record.')
        return
      }

      setSearchResults(prev => ({ ...prev, [item.id]: [] }))
      await loadRequests()
      setActiveStep({ requestId: item.id, step: 'verify' })
    } catch (error) {
      console.warn('Select source record error:', error)
      toast.error('Unable to select this archive record right now.')
    } finally {
      setBusyId(null)
    }
  }

  const updateStatus = async (
    item: CertificateRequest,
    status: 'Approved' | 'Rejected' | 'Released'
  ) => {
    if (status === 'Approved' && !item.matchedDocumentId) {
      toast.warning('Find and select the matching archive record before approving this request.')
      return
    }

    if (status === 'Released') {
      if (item.status !== 'Ready') {
        toast.warning('The final release document must be prepared first.')
        return
      }
      if (isTestCertificatePayment(item.paymentMethod)) {
        toast.warning('This was a test transaction; no real payment was received. Reconcile payment through the parish office before releasing.')
        return
      }
      if (!isConfirmedCertificatePayment(item.paymentStatus, item.paymentMethod)) {
        toast.warning('A verified live payment or official cash receipt is required before release.')
        return
      }
      if (!item.generatedFile) {
        toast.warning('Upload the final release document before releasing it.')
        return
      }
    }

    const remarks =
      status === 'Approved'
        ? 'The archive record has been verified. Staff is preparing the final document.'
        : status === 'Rejected'
          ? 'Your request has been rejected. Please contact the parish office for more information.'
          : 'Your requested document has been released and is available for download.'

    try {
      setBusyId(item.id)
      const res = await fetch(`/api/backend/api/requests/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || data.message || 'Failed to update request status.')
        return
      }

      await loadRequests()
      if (status === 'Approved') setActiveStep({ requestId: item.id, step: 'prepare' })
      if (status === 'Released') setActiveStep({ requestId: item.id, step: 'release' })
    } catch (err) {
      console.warn('Update status error:', err)
      toast.error('Unable to update this request right now.')
    } finally {
      setBusyId(null)
    }
  }

  const uploadReleaseDocument = async (item: CertificateRequest) => {
    const file = releaseFiles[item.id]

    if (!item.matchedDocumentId) {
      toast.warning('Select the verified archive source record first.')
      return
    }

    if (item.status !== 'Approved' && item.status !== 'Ready') {
      toast.warning('Approve the request before uploading the final release document.')
      return
    }

    if (!file) {
      toast.warning('Choose the final certificate/document file first.')
      return
    }

    const formData = new FormData()
    if (item.identity) {
      const reviewed = await confirmAction(item.identity.unredacted
        ? 'Have you reviewed the ID or authorization document and confirmed that this requester may receive the unredacted copy?'
        : 'Have you checked the final file and redacted private information for this copy?')
      if (!reviewed) return
      formData.append('reviewed_copy', item.identity.unredacted ? 'unredacted' : 'redacted')
    }
    formData.append('file', file)

    try {
      setBusyId(item.id)
      const res = await fetch(`/api/backend/api/requests/${item.id}/release-document`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || data.message || 'Unable to upload the final document.')
        return
      }

      setReleaseFiles(prev => ({ ...prev, [item.id]: null }))
      await loadRequests()
      setActiveStep({ requestId: item.id, step: 'release' })
    } catch (error) {
      console.warn('Release document upload error:', error)
      toast.error('Unable to upload the final document right now.')
    } finally {
      setBusyId(null)
    }
  }

  const generateReleaseDocument = async (item: CertificateRequest) => {
    if (!item.matchedDocumentId) {
      toast.warning('Select the verified archive source record first.')
      return
    }

    if (item.status !== 'Approved' && item.status !== 'Ready') {
      toast.warning('Approve the request before generating the final release document.')
      return
    }

    const confirmed = await confirmAction(
      'Generate an official-form draft from the verified archive record? The draft is not released to the parishioner. Staff must review it, complete required signatures/legal fields, and upload the reviewed final document.'
    )
    if (!confirmed) return

    try {
      setBusyId(item.id)
      const res = await fetch(`/api/backend/api/requests/${item.id}/generate-document`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || data.message || 'Unable to generate the release document.')
        return
      }
      await loadRequests()
    } catch (error) {
      console.warn('Generate release document error:', error)
      toast.error('Unable to generate the release document right now.')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = requests.filter(r => filter === 'All' || r.status === filter)

  const title = urgentOnly
    ? 'Urgent Requests'
    : office === 'burial'
      ? 'Burial Office Requests'
      : 'Requests'

  const description = urgentOnly
    ? 'Process urgent requests using the same verified record-to-release workflow.'
    : office === 'burial'
      ? 'Find the correct burial or land record, verify it, then prepare the final document for release.'
      : 'Find the correct archive record, verify it, then prepare the final document for release.'

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-display text-navy-mid text-xl font-semibold">{title}</h2>
          {urgentOnly && (
            <span className="font-display text-xs tracking-wider uppercase bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-full">
              Priority Queue
            </span>
          )}
        </div>
        <p className="font-body text-slate-500 text-[14px] mt-1">{readOnly ? "Review certificate requests and verify requester information." : description}</p>
      </div>

      {!readOnly && (
        <details className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Notification management</summary>
          <div className="pt-3"><NotificationOutboxControl /></div>
        </details>
      )}
      <form className="request-search" onSubmit={event => {
        event.preventDefault()
        setPage(1)
        setQuery(String(new FormData(event.currentTarget).get('q') || '').trim())
      }}>
        <label>Search by requester, parent, or name on record
          <input name="q" type="search" maxLength={150} />
        </label><button>Search requests</button>
      </form>

      {/* Keep status selection visible while scrolling long certificate queues. */}
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
        <label htmlFor="staff-request-status-filter" className="flex min-w-48 flex-col gap-1 text-sm font-semibold text-slate-800">
          Filter certificate requests
          <select
            id="staff-request-status-filter"
            aria-label="Filter certificate requests by status"
            value={filter}
            onChange={event => {
              setPage(1)
              setFilter(event.target.value as ReqStatus)
              setActiveStep(null)
            }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {FILTERS.map(status => (
              <option key={status} value={status}>
                {status === 'All' ? 'All requests' : status} ({status === 'All'
                  ? Object.values(counts).reduce((sum, count) => sum + count, 0)
                  : counts[status] || 0})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadRequests()}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <i aria-hidden="true" className="ti ti-refresh mr-2" />Refresh requests
        </button>
      </div>
      <nav className="parish-pager" aria-label="Request pages">
        <button disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </nav>
      {loadError && <p role="alert">Could not load requests. <button onClick={loadRequests}>Try again</button></p>}
      <div className="space-y-3">
        {loading ? (
          <EmptyCard icon="ti-loader-2 animate-spin" title="Loading requests..." />
        ) : filtered.length === 0 ? (
          <EmptyCard icon="ti-inbox" title="No requests found" />
        ) : (
          filtered.map(item => {
            const isBusy = busyId === item.id
            const isSearching = searchingId === item.id
            const results = searchResults[item.id] || []
            // Only sacramental categories have configured official PDF templates.
            const canAutoGenerate = ['baptismal', 'confirmation', 'marriage'].includes(item.sacramentType)
            const canRelease =
              item.status === 'Ready' &&
              isConfirmedCertificatePayment(item.paymentStatus, item.paymentMethod) &&
              Boolean(item.generatedFile)

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl overflow-hidden border shadow-sm ${
                  item.isUrgent ? 'border-orange-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                        item.isUrgent
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <i
                        className={`ti ${getRequestIcon(item.sacramentType)} ${
                          item.isUrgent ? 'text-orange-600' : 'text-gold'
                        } text-[17px]`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display text-navy-mid text-base font-semibold">
                          {item.requesterName || 'Requester unavailable'}
                        </p>
                        <span className="font-display text-xs tracking-wider text-slate-500">
                          IFI-REQ-{item.id.toString().padStart(4, '0')}
                        </span>
                        {item.isUrgent && (
                          <span className="font-display text-xs tracking-wider uppercase bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="font-body text-slate-500 text-sm mt-0.5">
                        {toDisplayType(item.sacramentType)}
                        {item.createdAt ? ` · Submitted ${item.createdAt.slice(0, 10)}` : ''}
                      </p>
                    </div>
                  </div>

                </div>

                <div className="border-t border-slate-100 px-5 py-5 bg-slate-50/60 space-y-4">

                    {/* Only the four colored milestones are visible until staff opens a step. */}
                    <RequestTracking
                      request={item}
                      selectedStep={activeStep?.requestId === item.id ? activeStep.step : null}
                      onStepSelect={step => {
                        setSearchTerms(prev => ({ ...prev, [item.id]: prev[item.id] ?? item.personName }))
                        setActiveStep(prev =>
                          prev?.requestId === item.id && prev.step === step ? null : { requestId: item.id, step }
                        )
                      }}
                    />
                    {activeStep?.requestId === item.id && (
                      <section
                        id={`staff-workflow-panel-${item.id}`}
                        aria-label={`Open workflow step: ${activeStep.step}`}
                        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm"
                      >
                        {activeStep.step === 'submitted' && (
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-slate-900">Step 1 — Account and requested information</h3>
                            <p className="text-sm text-slate-600">Review both information tables below: the signed-in requester's account details and the information for the person or document being requested.</p>
                            <RequestDetails office={!readOnly} request={item} documentType={toDisplayType(item.sacramentType)} />
                          </div>
                        )}

                        {activeStep.step === 'verify' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Step 2 — Staff verification</h3>
                            {item.status !== 'Pending' && item.matchedDocument && (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                Matching archive: <strong>{item.matchedDocument.personName}</strong>
                                <a href={backendFileUrl(item.matchedDocument.filepath)} target="_blank" rel="noopener noreferrer" className="ml-3 underline">Preview source record</a>
                              </div>
                            )}
                            {!readOnly && item.status === 'Pending' ? (
                              <>
                                <p className="text-sm text-slate-700">Find and verify the matching church record before approving. If you need the request details, click Step 1.</p>
                                <div className="space-y-4">

                      {item.matchedDocument ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-display text-sm text-emerald-800 font-semibold">
                                ✓ Verified source record
                              </p>
                              <p className="font-body text-base text-navy-mid mt-1 font-semibold">
                                {item.matchedDocument.personName}
                              </p>
                              <p className="font-body text-sm text-slate-600 mt-1">
                                {item.matchedDocument.certificateNumber || `Archive #${item.matchedDocument.id}`}
                                {item.matchedDocument.dateOfRecord ? ` · ${item.matchedDocument.dateOfRecord}` : ''}
                              </p>
                            </div>
                            <a
                              href={backendFileUrl(item.matchedDocument.filepath)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-display text-xs tracking-wider bg-white text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg"
                            >
                              Preview Source
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="font-body text-sm text-slate-600 mb-3">
                          Search is already restricted to {toDisplayType(item.sacramentType)} records.
                        </p>
                      )}

                      <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={searchTerms[item.id] ?? item.personName}
                              onChange={e =>
                                setSearchTerms(prev => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Search name in archive"
                              className="min-w-[240px] flex-1 border border-slate-200 rounded-lg px-3 py-2 font-body text-sm text-navy-mid bg-white focus:outline-none focus:border-gold"
                            />
                            <button
                              type="button"
                              disabled={isSearching}
                              onClick={() => void searchArchive(item)}
                              className="font-display text-xs tracking-wider bg-navy text-white px-4 py-2 rounded-lg disabled:opacity-50"
                            >
                              {isSearching ? 'Searching...' : item.matchedDocument ? 'Change / Search Again' : 'Search Archive'}
                            </button>
                          </div>

                          {results.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
                              {results.map(document => (
                                <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <p className="font-display text-sm text-navy-mid font-semibold">
                                    {document.personName}
                                  </p>
                                  <p className="font-body text-sm text-slate-500 mt-1">
                                    {document.certificateNumber || `Archive #${document.id}`}
                                    {document.dateOfRecord ? ` · ${document.dateOfRecord}` : ''}
                                  </p>
                                  <p className="font-body text-sm text-slate-500 mt-1">
                                    {document.parish || 'No parish listed'}
                                    {document.priest ? ` · ${document.priest}` : ''}
                                  </p>
                                  <div className="flex gap-2 mt-3 flex-wrap">
                                    <a
                                      href={backendFileUrl(document.filepath)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-display text-xs tracking-wider border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
                                    >
                                      Preview
                                    </a>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void selectSourceRecord(item, document)}
                                      className="font-display text-xs tracking-wider bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                                    >
                                      Select Record
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {searchResults[item.id] && results.length === 0 && !isSearching && (
                            <p className="font-body text-sm text-amber-700 mt-3">
                              No matching archive record found. Try another spelling or add the record to Archives first.
                            </p>
                          )}
                        </>
                                </div>
                                <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                                  <button type="button" className="portal-primary-btn" disabled={isBusy || !item.matchedDocumentId}
                                    onClick={() => void updateStatus(item, 'Approved')}>Approve verified request</button>
                                  <button type="button" className="portal-secondary-btn" disabled={isBusy}
                                    onClick={() => void updateStatus(item, 'Rejected')}>Reject request</button>
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-slate-700">
                                {item.status === 'Pending' ? 'Staff must verify the source record.' :
                                  item.status === 'Rejected' ? 'This request was rejected and cannot be processed further.' :
                                  item.status === 'Cancelled' ? 'This request was cancelled.' :
                                  'The verification stage has already been completed.'}
                              </p>
                            )}
                            {!readOnly && item.status === 'Approved' && !isConfirmedCertificatePayment(item.paymentStatus, item.paymentMethod) && (
                              <button type="button" className="portal-secondary-btn" disabled={isBusy}
                                onClick={() => void updateStatus(item, 'Rejected')}>Reject approved unpaid request</button>
                            )}
                          </div>
                        )}

                        {activeStep.step === 'prepare' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Step 3 — Document preparation</h3>
                            {!readOnly && ['Approved', 'Ready'].includes(item.status) ? (
                              <div className="space-y-4">

                      {item.draftFile && (
                        <div className="rounded-lg border border-blue-200 bg-white p-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-display text-xs tracking-wider uppercase text-blue-700">
                              Generated official-form draft
                            </p>
                            <p className="font-body text-sm text-navy-mid mt-1">
                              Review this draft, complete signatures/legal fields when applicable, then upload the reviewed final document.
                            </p>
                          </div>
                          <a
                            href={backendFileUrl(item.draftFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-display text-xs tracking-wider text-blue-700 border border-blue-200 px-3 py-2 rounded-lg"
                          >
                            Preview Draft
                          </a>
                        </div>
                      )}

                      {item.generatedFile && (
                        <div className="rounded-lg border border-violet-200 bg-white p-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-display text-xs tracking-wider uppercase text-violet-700">
                              Final release document
                            </p>
                            <p className="font-body text-sm text-navy-mid mt-1">
                              {releaseFileName(item.generatedFile)}
                            </p>
                          </div>
                          <a
                            href={backendFileUrl(item.generatedFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-display text-xs tracking-wider text-violet-700 border border-violet-200 px-3 py-2 rounded-lg"
                          >
                            Preview Final File
                          </a>
                        </div>
                      )}

                      {item.status === 'Approved' || item.status === 'Ready' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {canAutoGenerate ? (
                            <button
                              type="button"
                              disabled={isBusy || !item.matchedDocumentId}
                              onClick={() => void generateReleaseDocument(item)}
                              className="font-display text-xs tracking-wider bg-blue-600 text-white px-3 py-2 rounded-lg disabled:opacity-40"
                            >
                              Generate Official Form Draft
                            </button>
                            ) : (
                              <span className="font-body text-sm text-amber-800">
                                No automatic official template is configured for this document type. Church Staff must verify the source record and upload the approved and signed final document below.
                              </span>
                            )}
                            {canAutoGenerate && (
                              <span className="font-body text-sm text-slate-500">
                                Then upload the reviewed/signed final certificate below.
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="file"
                            accept=".pdf,.docx,.jpg,.jpeg,.png"
                            onChange={e =>
                              setReleaseFiles(prev => ({
                                ...prev,
                                [item.id]: e.target.files?.[0] || null,
                              }))
                            }
                            className="font-body text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2"
                          />
                          <button
                            type="button"
                            disabled={isBusy || !releaseFiles[item.id]}
                            onClick={() => void uploadReleaseDocument(item)}
                            className="font-display text-xs tracking-wider bg-violet-600 text-white px-3 py-2 rounded-lg disabled:opacity-40"
                          >
                            {item.generatedFile ? 'Replace final document' : 'Mark ready with reviewed file'}
                          </button>
                          <span className="font-body text-sm text-slate-500">
                            PDF is recommended. DOCX/JPG/PNG are also accepted.
                          </span>
                          </div>
                        </div>
                      ) : (
                        <p className="font-body text-sm text-slate-600">
                          {item.status === 'Pending'
                            ? 'Approve the verified request before preparing the final document.'
                            : item.status === 'Released'
                              ? 'This request has already been released.'
                              : 'No final document can be uploaded for this request.'}
                        </p>
                      )}
                              </div>
                            ) : <p className="text-sm text-slate-700">
                              {item.status === 'Released' ? 'The final document has already been released.' : 'Staff must approve a verified request before preparing the final document.'}
                              {item.status === 'Released' && item.generatedFile && (
                                <a href={backendFileUrl(item.generatedFile)} target="_blank" rel="noopener noreferrer"
                                  className="ml-2 font-semibold underline">Review final document</a>
                              )}
                            </p>}
                          </div>
                        )}

                        {activeStep.step === 'release' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Step 4 — Payment and office release</h3>
                            <RequestTracking request={item} paymentOnly />
                            {!readOnly && item.status === 'Ready' && (
                              canRelease ? (
                                <button type="button" className="portal-primary-btn min-h-11" disabled={isBusy}
                                  onClick={() => void updateStatus(item, 'Released')}>Release verified certificate</button>
                              ) : (
                                <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                  {isTestCertificatePayment(item.paymentMethod)
                                    ? 'A simulated payment is recorded, but no real money was received. Do not release this certificate. Contact the parish office to reconcile it before another payment.'
                                    : 'Release requires a verified source record, reviewed final document and confirmed live payment or official cash receipt.'}
                                </p>
                              )
                            )}
                            {item.status === 'Released' && <p className="text-sm font-semibold text-emerald-800">Release completed and recorded by parish staff.</p>}
                            <section className="border-t border-slate-200 pt-4">
                              <h4 className="text-base font-semibold text-slate-900">Recorded status changes</h4>
                              {item.history?.length ? (
                                <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4 text-sm text-slate-700">
                                  {item.history.map((event, i) => (
                                    <li key={i}>
                                      <strong>{event.status}</strong>
                                      <span className="ml-2">{new Date(event.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                                    </li>
                                  ))}
                                </ol>
                              ) : <p className="mt-2 text-sm text-slate-600">Current status: {item.status}. Earlier transitions were not recorded.</p>}
                            </section>
                          </div>
                        )}
                      </section>
                    )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function EmptyCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
      <i className={`ti ${icon} text-slate-300 text-3xl inline-block mb-2`} />
      <p className="font-body text-slate-500 text-base">{title}</p>
    </div>
  )
}

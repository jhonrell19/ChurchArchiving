'use client'

import { useEffect, useState } from 'react'
import { CERT_ICONS, STATUS_STYLE } from '../data/ui'

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
  requesterUserId: number | null
  requesterName: string
  requesterEmail: string
  contactNumber: string
  requesterAddress: string | null
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
  generatedFile: string | null
  createdAt: string | null
  updatedAt: string | null
}

type Props = {
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
    case 'burial':
    case 'death':
      return 'Burial Certificate'
    case 'land_agreement':
      return 'Land Agreement'
    default:
      return type
  }
}

const getRequestIcon = (type: string) =>
  CERT_ICONS[toDisplayType(type)] || CERT_ICONS[type] || 'ti-file-certificate'

const getStatusStyle = (status: string) =>
  STATUS_STYLE[status] || 'bg-slate-50 text-slate-600 border-slate-200'

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

export default function RequestsPage({ urgentOnly = false, office = 'main' }: Props) {
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [filter, setFilter] = useState<ReqStatus>('All')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [searchingId, setSearchingId] = useState<number | null>(null)
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({})
  const [searchResults, setSearchResults] = useState<Record<number, ArchiveDocument[]>>({})
  const [releaseFiles, setReleaseFiles] = useState<Record<number, File | null>>({})

  const loadRequests = async () => {
    try {
      setLoading(true)
      const priority = urgentOnly ? 'urgent' : 'regular'
      const res = await fetch(`/api/backend/api/requests?priority=${priority}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load requests')
      }

      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      console.warn('Load requests error:', err)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadRequests())
  }, [urgentOnly])

  const toggleExpanded = (item: CertificateRequest) => {
    const opening = expanded !== item.id
    setExpanded(opening ? item.id : null)

    if (opening) {
      setSearchTerms(prev => ({
        ...prev,
        [item.id]: prev[item.id] ?? item.personName,
      }))
    }
  }

  const searchArchive = async (item: CertificateRequest) => {
    const query = (searchTerms[item.id] ?? item.personName).trim()

    if (!query) {
      alert('Enter a name to search for.')
      return
    }

    try {
      setSearchingId(item.id)
      const res = await fetch(
        `/api/backend/api/archive/documents/${encodeURIComponent(item.sacramentType)}?q=${encodeURIComponent(query)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.error || data.message || 'Unable to search the archive.')
        return
      }

      setSearchResults(prev => ({
        ...prev,
        [item.id]: Array.isArray(data.documents) ? data.documents : [],
      }))
    } catch (error) {
      console.warn('Archive search error:', error)
      alert('Unable to search the archive right now.')
    } finally {
      setSearchingId(null)
    }
  }

  const selectSourceRecord = async (item: CertificateRequest, document: ArchiveDocument) => {
    const confirmed = window.confirm(
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
        alert(data.error || data.message || 'Unable to select this archive record.')
        return
      }

      setSearchResults(prev => ({ ...prev, [item.id]: [] }))
      await loadRequests()
    } catch (error) {
      console.warn('Select source record error:', error)
      alert('Unable to select this archive record right now.')
    } finally {
      setBusyId(null)
    }
  }

  const updateStatus = async (
    item: CertificateRequest,
    status: 'Approved' | 'Rejected' | 'Released'
  ) => {
    if (status === 'Approved' && !item.matchedDocumentId) {
      alert('Find and select the matching archive record before approving this request.')
      return
    }

    if (status === 'Released') {
      if (item.status !== 'Ready') {
        alert('The final release document must be prepared first.')
        return
      }
      if (item.paymentStatus !== 'Paid') {
        alert('Payment must be confirmed before the document can be released.')
        return
      }
      if (!item.generatedFile) {
        alert('Upload the final release document before releasing it.')
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
        alert(data.error || data.message || 'Failed to update request status.')
        return
      }

      await loadRequests()
    } catch (err) {
      console.warn('Update status error:', err)
      alert('Unable to update this request right now.')
    } finally {
      setBusyId(null)
    }
  }

  const uploadReleaseDocument = async (item: CertificateRequest) => {
    const file = releaseFiles[item.id]

    if (!item.matchedDocumentId) {
      alert('Select the verified archive source record first.')
      return
    }

    if (item.status !== 'Approved' && item.status !== 'Ready') {
      alert('Approve the request before uploading the final release document.')
      return
    }

    if (!file) {
      alert('Choose the final certificate/document file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      setBusyId(item.id)
      const res = await fetch(`/api/backend/api/requests/${item.id}/release-document`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.error || data.message || 'Unable to upload the final document.')
        return
      }

      setReleaseFiles(prev => ({ ...prev, [item.id]: null }))
      await loadRequests()
    } catch (error) {
      console.warn('Release document upload error:', error)
      alert('Unable to upload the final document right now.')
    } finally {
      setBusyId(null)
    }
  }

  const generateReleaseDocument = async (item: CertificateRequest) => {
    if (!item.matchedDocumentId) {
      alert('Select the verified archive source record first.')
      return
    }

    if (item.status !== 'Approved' && item.status !== 'Ready') {
      alert('Approve the request before generating the final release document.')
      return
    }

    const confirmed = window.confirm(
      'Generate a system draft PDF from the verified archive record? Staff should review/sign/seal it according to parish policy before release.'
    )
    if (!confirmed) return

    try {
      setBusyId(item.id)
      const res = await fetch(`/api/backend/api/requests/${item.id}/generate-document`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || data.message || 'Unable to generate the release document.')
        return
      }
      await loadRequests()
    } catch (error) {
      console.warn('Generate release document error:', error)
      alert('Unable to generate the release document right now.')
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
            <span className="font-display text-[9px] tracking-wider uppercase bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-full">
              Priority Queue
            </span>
          )}
        </div>
        <p className="font-body text-slate-500 text-[14px] mt-1">{description}</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(status => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`font-display text-[11px] tracking-wider px-4 py-1.5 rounded-full border transition-all ${
              filter === status
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy-mid border-slate-200 hover:border-gold/60'
            }`}
          >
            {status}
            <span className="ml-1.5 text-[10px] opacity-70">
              {status === 'All'
                ? requests.length
                : requests.filter(r => r.status === status).length}
            </span>
          </button>
        ))}
      </div>

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
            const canRelease =
              item.status === 'Ready' &&
              item.paymentStatus === 'Paid' &&
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
                        <p className="font-display text-navy-mid text-[13px] font-semibold">
                          {item.personName}
                        </p>
                        <span className="font-display text-[10px] tracking-wider text-slate-500">
                          IFI-REQ-{item.id.toString().padStart(4, '0')}
                        </span>
                        {item.isUrgent && (
                          <span className="font-display text-[9px] tracking-wider uppercase bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="font-body text-slate-500 text-[11px] mt-0.5">
                        {toDisplayType(item.sacramentType)}
                        {item.createdAt ? ` · Submitted ${item.createdAt.slice(0, 10)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <span
                      className={`font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${getStatusStyle(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span
                      className={`font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${
                        item.paymentStatus === 'Paid'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.paymentStatus || 'Unpaid'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Expand request"
                    >
                      <i className={`ti ${expanded === item.id ? 'ti-chevron-up' : 'ti-chevron-down'} text-[14px]`} />
                    </button>
                  </div>
                </div>

                {expanded === item.id && (
                  <div className="border-t border-slate-100 px-5 py-5 bg-slate-50/60 space-y-4">
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="font-display text-[11px] tracking-wider uppercase text-navy-mid mb-3">
                        Request Details
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Info label="Requester" value={item.requesterName || 'N/A'} />
                        <Info label="Email" value={item.requesterEmail || 'N/A'} />
                        <Info label="Phone" value={item.contactNumber || 'N/A'} />
                        <Info label="Address" value={item.requesterAddress || 'N/A'} />
                        <Info label="Requested Record" value={item.personName} />
                        <Info label="Document Type" value={toDisplayType(item.sacramentType)} />
                        <Info label="Priority" value={item.isUrgent ? 'Urgent' : 'Regular'} />
                        <Info label="Total Fee" value={formatPeso(item.totalFee)} />
                        <Info label="Payment" value={item.paymentStatus || 'Unpaid'} />
                        <Info label="Payment Method" value={item.paymentMethod || 'Not paid'} />
                        <Info label="Payment Reference" value={item.paymentReference || 'None'} />
                        <div className="md:col-span-2">
                          <Info label="Purpose" value={item.purpose || 'No purpose provided'} />
                          <Info label="Approx. Record Date" value={item.recordDateHint || 'Not provided'} />
                          <Info label="Identifying Details" value={item.recordDetails || 'Not provided'} />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                      <StepTitle number="1" title="Find and verify the archive source record" />

                      {item.matchedDocument ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-display text-[11px] text-emerald-800 font-semibold">
                                ✓ Verified source record
                              </p>
                              <p className="font-body text-[13px] text-navy-mid mt-1 font-semibold">
                                {item.matchedDocument.personName}
                              </p>
                              <p className="font-body text-[11px] text-slate-600 mt-1">
                                {item.matchedDocument.certificateNumber || `Archive #${item.matchedDocument.id}`}
                                {item.matchedDocument.dateOfRecord ? ` · ${item.matchedDocument.dateOfRecord}` : ''}
                                {item.matchedDocument.bookNumber ? ` · Book ${item.matchedDocument.bookNumber}` : ''}
                                {item.matchedDocument.pageNumber ? ` / Page ${item.matchedDocument.pageNumber}` : ''}
                              </p>
                            </div>
                            <a
                              href={backendFileUrl(item.matchedDocument.filepath)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-display text-[10px] tracking-wider bg-white text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg"
                            >
                              Preview Source
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="font-body text-[12px] text-slate-600 mb-3">
                          Search is already restricted to {toDisplayType(item.sacramentType)} records.
                        </p>
                      )}

                      {item.status !== 'Released' && item.status !== 'Rejected' && (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={searchTerms[item.id] ?? item.personName}
                              onChange={e =>
                                setSearchTerms(prev => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Search name in archive"
                              className="min-w-[240px] flex-1 border border-slate-200 rounded-lg px-3 py-2 font-body text-[12px] text-navy-mid bg-white focus:outline-none focus:border-gold"
                            />
                            <button
                              type="button"
                              disabled={isSearching}
                              onClick={() => void searchArchive(item)}
                              className="font-display text-[10px] tracking-wider bg-navy text-white px-4 py-2 rounded-lg disabled:opacity-50"
                            >
                              {isSearching ? 'Searching...' : item.matchedDocument ? 'Change / Search Again' : 'Search Archive'}
                            </button>
                          </div>

                          {results.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
                              {results.map(document => (
                                <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <p className="font-display text-[12px] text-navy-mid font-semibold">
                                    {document.personName}
                                  </p>
                                  <p className="font-body text-[11px] text-slate-500 mt-1">
                                    {document.certificateNumber || `Archive #${document.id}`}
                                    {document.dateOfRecord ? ` · ${document.dateOfRecord}` : ''}
                                  </p>
                                  <p className="font-body text-[11px] text-slate-500 mt-1">
                                    {document.parish || 'No parish listed'}
                                    {document.priest ? ` · ${document.priest}` : ''}
                                  </p>
                                  <div className="flex gap-2 mt-3 flex-wrap">
                                    <a
                                      href={backendFileUrl(document.filepath)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-display text-[10px] tracking-wider border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
                                    >
                                      Preview
                                    </a>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void selectSourceRecord(item, document)}
                                      className="font-display text-[10px] tracking-wider bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                                    >
                                      Select Record
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {searchResults[item.id] && results.length === 0 && !isSearching && (
                            <p className="font-body text-[12px] text-amber-700 mt-3">
                              No matching archive record found. Try another spelling or add the record to Archives first.
                            </p>
                          )}
                        </>
                      )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                      <StepTitle number="2" title="Approve the verified request" />
                      {item.status === 'Pending' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={isBusy || !item.matchedDocumentId}
                            onClick={() => void updateStatus(item, 'Approved')}
                            className="font-display text-[10px] tracking-wider bg-blue-600 text-white px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Approve Verified Request
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void updateStatus(item, 'Rejected')}
                            className="font-display text-[10px] tracking-wider bg-white text-red-700 border border-red-200 px-3 py-2 rounded-lg disabled:opacity-50"
                          >
                            Reject Request
                          </button>
                          {!item.matchedDocumentId && (
                            <span className="font-body text-[11px] text-amber-700">
                              Select the source record first.
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="font-body text-[12px] text-slate-600">
                          Current request status: <strong>{item.status}</strong>
                        </p>
                      )}
                    </section>

                    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
                      <StepTitle number="3" title="Prepare the final release document" />

                      {item.generatedFile && (
                        <div className="rounded-lg border border-violet-200 bg-white p-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-display text-[10px] tracking-wider uppercase text-violet-700">
                              Final release document
                            </p>
                            <p className="font-body text-[12px] text-navy-mid mt-1">
                              {releaseFileName(item.generatedFile)}
                            </p>
                          </div>
                          <a
                            href={backendFileUrl(item.generatedFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-display text-[10px] tracking-wider text-violet-700 border border-violet-200 px-3 py-2 rounded-lg"
                          >
                            Preview Final File
                          </a>
                        </div>
                      )}

                      {item.status === 'Approved' || item.status === 'Ready' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              disabled={isBusy || !item.matchedDocumentId}
                              onClick={() => void generateReleaseDocument(item)}
                              className="font-display text-[10px] tracking-wider bg-blue-600 text-white px-3 py-2 rounded-lg disabled:opacity-40"
                            >
                              Generate Draft PDF
                            </button>
                            <span className="font-body text-[11px] text-slate-500">
                              Or upload the parish-prepared final certificate below.
                            </span>
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
                            className="font-body text-[12px] text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2"
                          />
                          <button
                            type="button"
                            disabled={isBusy || !releaseFiles[item.id]}
                            onClick={() => void uploadReleaseDocument(item)}
                            className="font-display text-[10px] tracking-wider bg-violet-600 text-white px-3 py-2 rounded-lg disabled:opacity-40"
                          >
                            {item.generatedFile ? 'Replace Final Document' : 'Upload Final Document'}
                          </button>
                          <span className="font-body text-[11px] text-slate-500">
                            PDF is recommended. DOCX/JPG/PNG are also accepted.
                          </span>
                          </div>
                        </div>
                      ) : (
                        <p className="font-body text-[12px] text-slate-600">
                          {item.status === 'Pending'
                            ? 'Approve the verified request before preparing the final document.'
                            : item.status === 'Released'
                              ? 'This request has already been released.'
                              : 'No final document can be uploaded for this request.'}
                        </p>
                      )}
                    </section>

                    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                      <StepTitle number="4" title="Release to the parishioner" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <CheckRow label="Source record verified" ok={Boolean(item.matchedDocumentId)} />
                        <CheckRow label="Final document prepared" ok={Boolean(item.generatedFile)} />
                        <CheckRow label="Payment confirmed" ok={item.paymentStatus === 'Paid'} />
                      </div>

                      {canRelease ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void updateStatus(item, 'Released')}
                          className="font-display text-[10px] tracking-wider bg-emerald-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                        >
                          Release Document to User
                        </button>
                      ) : item.status === 'Released' ? (
                        <p className="font-body text-[12px] text-emerald-700">
                          Released. The request owner can now download the final document.
                        </p>
                      ) : (
                        <p className="font-body text-[12px] text-amber-700">
                          Release becomes available only when the request is Ready, the final document exists, and payment is Paid.
                        </p>
                      )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                      <Info label="Staff Remarks" value={item.remarks || 'No remarks yet'} />
                    </section>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-6 h-6 rounded-full bg-navy text-white font-display text-[10px] flex items-center justify-center">
        {number}
      </span>
      <p className="font-display text-[11px] tracking-wider text-navy-mid font-semibold">{title}</p>
    </div>
  )
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? 'bg-white border-emerald-200' : 'bg-white border-amber-200'}`}>
      <p className={`font-body text-[12px] ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        <i className={`ti ${ok ? 'ti-circle-check' : 'ti-clock'} mr-1`} />
        {label}
      </p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-[9px] tracking-widest uppercase text-slate-400 mb-1">{label}</p>
      <p className="font-body text-navy-mid text-[13px] break-words">{value}</p>
    </div>
  )
}

function EmptyCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
      <i className={`ti ${icon} text-slate-300 text-3xl inline-block mb-2`} />
      <p className="font-body text-slate-500 text-[13px]">{title}</p>
    </div>
  )
}

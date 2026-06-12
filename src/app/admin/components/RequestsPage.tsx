'use client'

import { useEffect, useState } from 'react'
import { CERT_ICONS, STATUS_STYLE } from '../data/mockData'

type ReqStatus = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Ready' | 'Released'

type CertificateRequest = {
  id: number
  requesterName: string
  requesterEmail: string
  contactNumber: string
  sacramentType: string
  personName: string
  purpose: string
  status: string
  remarks: string | null
  matchedDocumentId: number | null
  generatedFile: string | null
  createdAt: string
  updatedAt: string
}

const FILTERS: ReqStatus[] = [
  'All',
  'Pending',
  'Approved',
  'Ready',
  'Released',
  'Rejected',
]

const STATUS_OPTIONS: Exclude<ReqStatus, 'All'>[] = [
  'Pending',
  'Approved',
  'Ready',
  'Released',
  'Rejected',
]

const toDisplayType = (type: string) => {
  if (type === 'death') return 'Death Certificate'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const getIconKey = (type: string) => {
  if (type === 'death') return 'Death Certificate'
  return toDisplayType(type)
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [filter, setFilter] = useState<ReqStatus>('All')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [documentIds, setDocumentIds] = useState<Record<number, string>>({})

  const loadRequests = async () => {
    try {
      setLoading(true)

      const res = await fetch('http://127.0.0.1:5000/api/requests?scope=main')

      if (!res.ok) {
        throw new Error('Failed to load requests')
      }

      const data = await res.json()
      setRequests(data.requests || [])
    } catch (err) {
      console.error('Load requests error:', err)
      alert('Cannot load requests. Make sure Flask is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const updateStatus = async (id: number, status: string) => {
    const remarks =
  status === 'Approved'
    ? 'Your request has been approved and is now being processed.'
    : status === 'Rejected'
    ? 'Your request has been rejected. Please contact the parish office for more information.'
    : status === 'Ready'
    ? 'Your requested document is ready for release.'
    : status === 'Released'
    ? 'Your requested document has been released.'
    : ''

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/requests/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          remarks,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to update request status.')
        return
      }

      await loadRequests()
    } catch (err) {
      console.error('Update status error:', err)
      alert('Failed to update request status.')
    }
  }

  const attachDocument = async (requestId: number) => {
    const documentId = documentIds[requestId]

    if (!documentId) {
      alert('Please enter an archive document ID.')
      return
    }

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/requests/${requestId}/attach-document`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: Number(documentId),
          remarks: 'Your requested document is ready for release.',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to attach document.')
        return
      }

      alert('Document attached and request marked as Ready.')

      setDocumentIds(prev => ({
        ...prev,
        [requestId]: '',
      }))

      await loadRequests()
    } catch (err) {
      console.error('Attach document error:', err)
      alert('Failed to attach document.')
    }
  }

  const filtered = requests.filter(r => filter === 'All' || r.status === filter)

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Incoming Requests
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Review and process certificate requests submitted by parishioners.
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`font-display text-[11px] tracking-wider px-4 py-1.5 rounded-full border transition-all ${
              filter === s
                ? 'bg-navy text-gold border-navy'
                : 'bg-white text-navy-mid border-gold/20'
            }`}
          >
            {s}
            <span className="ml-1 text-[10px]">
              {s === 'All'
                ? requests.length
                : requests.filter(r => r.status === s).length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border border-gold/20 rounded-xl p-8 text-center">
            <p className="font-body text-[#9ab0c4] text-[13px]">
              Loading incoming requests...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gold/20 rounded-xl p-8 text-center">
            <p className="font-body text-[#9ab0c4] text-[13px]">
              No requests found.
            </p>
          </div>
        ) : (
          filtered.map(r => {
            const iconKey = getIconKey(r.sacramentType) as keyof typeof CERT_ICONS

            return (
              <div key={r.id} className="bg-white border border-gold/20 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                      <i
                        className={`ti ${
                          CERT_ICONS[iconKey] || 'ti-file-certificate'
                        } text-gold text-[16px]`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display text-navy-mid text-[13px] font-semibold">
                          {r.personName}
                        </p>

                        <span className="font-display text-[10px] tracking-wider text-gold/70">
                          IFI-REQ-{r.id.toString().padStart(4, '0')}
                        </span>
                      </div>

                      <p className="font-body text-[#9ab0c4] text-[11px]">
                        {toDisplayType(r.sacramentType)} · Submitted {r.createdAt?.slice(0, 10)} · {r.purpose}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${
                      STATUS_STYLE[r.status] || 'bg-white text-[#9ab0c4] border-gold/20'
                    }`}>
                      {r.status}
                    </span>

                    <button
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="p-1.5 rounded-lg border border-gold/20 text-[#9ab0c4]"
                      aria-label="Expand"
                    >
                      <i className={`ti ${expanded === r.id ? 'ti-chevron-up' : 'ti-chevron-down'} text-[14px]`} />
                    </button>
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="border-t border-gold/10 px-5 py-4 bg-gold/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          Requester
                        </p>
                        <p className="font-body text-navy-mid text-[13px]">
                          {r.requesterName}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          Contact
                        </p>
                        <p className="font-body text-navy-mid text-[13px]">
                          {r.contactNumber || 'N/A'} · {r.requesterEmail || 'No email'}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          Certificate Type
                        </p>
                        <p className="font-body text-navy-mid text-[13px]">
                          {toDisplayType(r.sacramentType)}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          Purpose
                        </p>
                        <p className="font-body text-navy-mid text-[13px]">
                          {r.purpose || 'No purpose provided'}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          Attached Document ID
                        </p>
                        <p className="font-body text-navy-mid text-[13px]">
                          {r.matchedDocumentId || 'No document attached yet'}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          File
                        </p>
                        {r.generatedFile ? (
                          <a
                            href={`http://127.0.0.1:5000/files/${r.generatedFile}`}
                            target="_blank"
                            className="font-body text-gold text-[13px] underline"
                          >
                            View attached document
                          </a>
                        ) : (
                          <p className="font-body text-navy-mid text-[13px]">
                            No file attached yet
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <p className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                          Admin Remarks
                        </p>
                        <p className="font-body text-navy-mid text-[13px] leading-relaxed">
                          {r.remarks || 'No remarks yet.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gold/10 mb-3">
                      <p className="font-display text-[11px] tracking-wider text-[#9ab0c4] mr-1">
                        Attach document:
                      </p>

                      <input
                        type="number"
                        placeholder="Archive Document ID"
                        value={documentIds[r.id] || ''}
                        onChange={e =>
                          setDocumentIds(prev => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        className="border border-gold/20 rounded-lg px-3 py-1.5 font-body text-[12px] text-navy-mid bg-white"
                      />

                      <button
                        onClick={() => attachDocument(r.id)}
                        className="font-display text-[10px] tracking-wider bg-navy text-gold border border-navy px-3 py-1.5 rounded-lg"
                      >
                        Attach Document & Mark Ready
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gold/10">
                      <p className="font-display text-[11px] tracking-wider text-[#9ab0c4] mr-1">
                        Update status:
                      </p>

                      {STATUS_OPTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(r.id, s)}
                          className={`font-display text-[10px] tracking-wider border px-3 py-1 rounded-full transition-all ${
                            r.status === s
                              ? STATUS_STYLE[s]
                              : 'bg-white text-[#9ab0c4] border-gold/20'
                          }`}
                        >
                          {s}
                        </button>
                      ))}

                      <button className="ml-auto flex items-center gap-1.5 font-display text-[11px] tracking-wider text-gold border border-gold/30 px-3 py-1.5 rounded-lg bg-gold/5">
                        <i className="ti ti-mail text-[13px]" />
                        Notify Parishioner
                      </button>
                    </div>
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
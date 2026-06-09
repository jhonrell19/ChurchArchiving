'use client'

import { useEffect, useState } from 'react'
import { REQUEST_ICONS, STATUS_STYLE, inputCls } from '../data/mockData'

type RequestType = 'Baptismal' | 'Marriage' | 'Death Certificate' | 'Confirmation'

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
}

const REQUEST_TYPES: RequestType[] = [
  'Baptismal',
  'Marriage',
  'Death Certificate',
  'Confirmation',
]

const toBackendType = (type: RequestType) => {
  if (type === 'Death Certificate') return 'death'
  return type.toLowerCase()
}

const toDisplayType = (type: string) => {
  if (type === 'death') return 'Death Certificate'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function RequestsPage() {
  const [activeType, setActiveType] = useState<RequestType>('Baptismal')
  const [view, setView] = useState<'form' | 'history'>('form')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<CertificateRequest[]>([])

  const [formData, setFormData] = useState({
    requesterName: '',
    requesterEmail: '',
    contactNumber: '',
    personName: '',
    purpose: '',
    notes: '',
  })

  const loadRequests = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/requests')

      if (!res.ok) {
        throw new Error('Failed to load requests')
      }

      const data = await res.json()
      setRequests(data.requests || [])
    } catch (err) {
      console.error('Load requests error:', err)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async () => {
    if (!formData.requesterName.trim()) {
      alert('Please enter requester name.')
      return
    }

    if (!formData.personName.trim()) {
      alert('Please enter the name on record.')
      return
    }

    if (!formData.purpose.trim()) {
      alert('Please enter the request purpose.')
      return
    }

    try {
      setLoading(true)

      const res = await fetch('http://127.0.0.1:5000/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requesterName: formData.requesterName,
          requesterEmail: formData.requesterEmail,
          contactNumber: formData.contactNumber,
          sacramentType: toBackendType(activeType),
          personName: formData.personName,
          purpose: formData.notes
            ? `${formData.purpose} | Notes: ${formData.notes}`
            : formData.purpose,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Request submission failed.')
        return
      }

      setSuccessMsg(`${activeType} request submitted successfully.`)

      setFormData({
        requesterName: '',
        requesterEmail: '',
        contactNumber: '',
        personName: '',
        purpose: '',
        notes: '',
      })

      await loadRequests()
      setView('history')

      setTimeout(() => setSuccessMsg(null), 6000)
    } catch (err) {
      console.error('Submit request error:', err)
      alert('Cannot submit request. Make sure Flask is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Certificate Requests
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Submit a request for parish certificates. The admin will be notified to process your request.
      </p>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <i className="ti ti-circle-check text-green-600 text-[18px] mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-display text-green-700 text-[13px] font-semibold mb-0.5">
              Request Submitted Successfully
            </p>
            <p className="font-body text-green-600 text-[13px]">
              {successMsg}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('form')}
          className={`font-display text-[12px] tracking-wider px-4 py-2 rounded-lg border transition-all ${
            view === 'form'
              ? 'bg-navy text-gold border-navy'
              : 'text-navy-mid border-gold/20 bg-white'
          }`}
        >
          <i className="ti ti-plus text-[13px] mr-1.5" />
          New Request
        </button>

        <button
          onClick={() => {
            loadRequests()
            setView('history')
          }}
          className={`font-display text-[12px] tracking-wider px-4 py-2 rounded-lg border transition-all ${
            view === 'history'
              ? 'bg-navy text-gold border-navy'
              : 'text-navy-mid border-gold/20 bg-white'
          }`}
        >
          <i className="ti ti-history text-[13px] mr-1.5" />
          My Requests

          {requests.length > 0 && (
            <span className="ml-1.5 bg-gold text-navy font-display text-[10px] px-1.5 py-0.5 rounded-full">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {view === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-2">
            {REQUEST_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  activeType === type
                    ? 'bg-navy border-navy text-gold'
                    : 'bg-white border-gold/20 text-navy-mid'
                }`}
              >
                <i
                  className={`ti ${REQUEST_ICONS[type]} text-[18px] ${
                    activeType === type ? 'text-gold' : 'text-[#9ab0c4]'
                  }`}
                />
                <span className="font-display text-[12px] tracking-wide">
                  {type}
                </span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 bg-white border border-gold/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gold/10">
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                <i className={`ti ${REQUEST_ICONS[activeType]} text-gold text-[18px]`} />
              </div>

              <div>
                <p className="font-display text-navy-mid text-[14px] font-semibold">
                  {activeType} Certificate Request
                </p>
                <p className="font-body text-[#6b8caa] text-[12px]">
                  Fields marked * are required.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Requester Name <span className="text-gold">*</span>
                </label>
                <input
                  value={formData.requesterName}
                  onChange={e => handleChange('requesterName', e.target.value)}
                  placeholder="Your full name"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.requesterEmail}
                  onChange={e => handleChange('requesterEmail', e.target.value)}
                  placeholder="your@email.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Contact Number
                </label>
                <input
                  value={formData.contactNumber}
                  onChange={e => handleChange('contactNumber', e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Name on Record <span className="text-gold">*</span>
                </label>
                <input
                  value={formData.personName}
                  onChange={e => handleChange('personName', e.target.value)}
                  placeholder="Name written on church record"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Purpose <span className="text-gold">*</span>
                </label>
                <input
                  value={formData.purpose}
                  onChange={e => handleChange('purpose', e.target.value)}
                  placeholder="School, employment, marriage, etc."
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                  placeholder="Additional details for the parish staff"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gold/10 flex items-center justify-between">
              <p className="font-body text-[12px] text-[#9ab0c4]">
                Processing typically takes 3–5 business days.
              </p>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 font-display text-[12px] tracking-wider bg-navy text-gold px-5 py-2.5 rounded-lg disabled:opacity-60"
              >
                <i className="ti ti-send text-[14px]" />
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {requests.length === 0 ? (
            <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
              <i className="ti ti-file-plus text-gold/30 text-5xl mb-3 block" />
              <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
                No requests yet
              </p>
              <p className="font-body text-[#9ab0c4] text-[13px]">
                Submit a new request to see it here.
              </p>
              <button
                onClick={() => setView('form')}
                className="mt-4 font-display text-[11px] tracking-wider text-gold border border-gold/30 px-4 py-2 rounded-lg"
              >
                Make a Request
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map(req => {
                const displayType = toDisplayType(req.sacramentType) as RequestType

                return (
                  <div key={req.id} className="bg-white border border-gold/20 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                          <i
                            className={`ti ${
                              REQUEST_ICONS[displayType] || 'ti-file-certificate'
                            } text-gold text-[17px]`}
                          />
                        </div>

                        <div>
                          <p className="font-display text-navy-mid text-[13px] font-semibold">
                            {displayType} Certificate
                          </p>
                          <p className="font-body text-[#9ab0c4] text-[11px] mt-0.5">
                            Ref: IFI-REQ-{req.id.toString().padStart(4, '0')} · Submitted{' '}
                            {req.createdAt?.slice(0, 10)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${
                          STATUS_STYLE[req.status] || 'bg-white text-[#9ab0c4] border-gold/20'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gold/10 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase">
                          Name on Record
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">
                          {req.personName}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase">
                          Purpose
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">
                          {req.purpose}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase">
                          Remarks
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">
                          {req.remarks || 'No remarks yet'}
                        </p>
                      </div>
                    </div>

                    {req.generatedFile && (req.status === 'Ready' || req.status === 'Released') && (
                      <div className="mt-4 pt-3 border-t border-gold/10 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase mb-1">
                            Attached Document
                          </p>
                          <p className="font-body text-[12px] text-navy-mid">
                            Your requested document is ready to download.
                          </p>
                        </div>

                        <a
                          href={`http://127.0.0.1:5000/files/${req.generatedFile}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg"
                        >
                          <i className="ti ti-download text-[13px]" />
                          Download Document
                        </a>
                      </div>
                    )}

                    {!req.generatedFile && req.status === 'Ready' && (
                      <div className="mt-4 pt-3 border-t border-gold/10">
                        <p className="font-body text-[12px] text-red-600">
                          This request is marked Ready, but no document file is attached yet. Please contact the parish staff.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
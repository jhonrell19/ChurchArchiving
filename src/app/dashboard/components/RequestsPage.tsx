'use client'

import { useEffect, useState } from 'react'
import { REQUEST_ICONS, STATUS_STYLE, inputCls } from '../data/ui'

type UserProfile = {
  id: number
  fullName: string
  email: string
  phoneNumber: string | null
  address: string | null
}

type RequestType =
  | 'Baptismal'
  | 'Confirmation'
  | 'Marriage'
  | 'Certificate of Ownership'
  | 'Land Agreement'

type AvailableCemeterySlot = {
  id: number
  slotCode: string
  section: string | null
  block: string | null
  lotNumber: string
  lotType: string
  mapLabel: string | null
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
  generatedFile: string | null
  createdAt: string | null
  updatedAt: string | null
}

type MeResponseUser = {
  id: number
  fullName?: string | null
  firstName?: string | null
  middleName?: string | null
  surname?: string | null
  email: string
  phoneNumber?: string | null
  address?: string | null
}

const INITIAL_FEES: Record<RequestType, number> = {
  Baptismal: 0,
  Confirmation: 0,
  Marriage: 0,
  'Certificate of Ownership': 0,
  'Land Agreement': 0,
}

const REQUEST_TYPES: RequestType[] = [
  'Baptismal',
  'Confirmation',
  'Marriage',
  'Certificate of Ownership',
  'Land Agreement',
]

const PURPOSE_OPTIONS: Record<RequestType, string[]> = {
  Baptismal: [
    'School Requirements',
    'Employment Requirements',
    'Church Requirements',
    'Personal Record',
    'Government or Legal Requirements',
    'Other (Specify in Notes)',
  ],

  Confirmation: [
    'Church Marriage Requirements',
    'School Requirements',
    'Employment Requirements',
    'Personal Record',
    'Government or Legal Requirements',
    'Other (Specify in Notes)',
  ],

  Marriage: [
    'Civil Registration Requirements',
    'Government or Legal Requirements',
    'Visa or Immigration Requirements',
    'Personal Record',
    'Other (Specify in Notes)',
  ],

  'Certificate of Ownership': [
    'Proof of Cemetery Lot Ownership',
    'Request Copy of Ownership Certificate',
    'Replacement of Lost or Damaged Certificate',
    'Cemetery Lot Ownership Verification',
    'Correction of Ownership Details',
    'Other (Specify in Notes)',
  ],

  'Land Agreement': [
    'Apply for Cemetery Lot Agreement',
    'Request Copy of Existing Land Agreement',
    'Review or Update Agreement Information',
    'Clarification of Cemetery Lot Terms',
    'Other (Specify in Notes)',
  ],
}

const REQUEST_TYPE_ICONS: Record<RequestType, string> = {
  Baptismal: REQUEST_ICONS.Baptismal || 'ti-droplet',
  Confirmation: REQUEST_ICONS.Confirmation || 'ti-shield-check',
  Marriage: REQUEST_ICONS.Marriage || 'ti-rings',
  'Certificate of Ownership': REQUEST_ICONS['Certificate of Ownership'] || 'ti-file-certificate',
  'Land Agreement': REQUEST_ICONS['Land Agreement'] || 'ti-file-contract',
}

const toBackendType = (type: RequestType) => {
  switch (type) {
    case 'Baptismal':
      return 'baptismal'
    case 'Confirmation':
      return 'confirmation'
    case 'Marriage':
      return 'marriage'
    case 'Certificate of Ownership':
      return 'ownership'
    case 'Land Agreement':
      return 'land_agreement'
  }
}

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

const getRequestIcon = (type: string) => {
  switch (type) {
    case 'Baptismal':
    case 'baptismal':
      return REQUEST_TYPE_ICONS.Baptismal
    case 'Confirmation':
    case 'confirmation':
      return REQUEST_TYPE_ICONS.Confirmation
    case 'Marriage':
    case 'marriage':
      return REQUEST_TYPE_ICONS.Marriage
    case 'Certificate of Ownership':
    case 'ownership':
      return REQUEST_TYPE_ICONS['Certificate of Ownership']
    case 'burial':
    case 'death':
      return 'ti-archive'
    case 'Land Agreement':
    case 'land_agreement':
      return REQUEST_TYPE_ICONS['Land Agreement']
    default:
      return 'ti-file-certificate'
  }
}

const getStatusStyle = (status: string) =>
  STATUS_STYLE[status as keyof typeof STATUS_STYLE] ||
  'bg-slate-50 text-slate-600 border-slate-200'

const formatPeso = (amount: number | null | undefined) =>
  `₱${Number(amount || 0).toLocaleString('en-PH')}`

export default function RequestsPage() {
  const [activeType, setActiveType] = useState<RequestType>('Baptismal')
  const [view, setView] = useState<'form' | 'history'>('form')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [requestsError, setRequestsError] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [availableSlots, setAvailableSlots] = useState<AvailableCemeterySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [parishFees, setParishFees] = useState(INITIAL_FEES)
  const [urgentFee, setUrgentFee] = useState(0)
  const [pricingReady, setPricingReady] = useState(false)
  const [paymentMode, setPaymentMode] = useState('test')
  const [serviceFees, setServiceFees] = useState<Record<string, number>>({})
  const [cemeteryFees, setCemeteryFees] = useState<Record<string, number>>({})
  useEffect(() => {
    let active = true
    fetch('/api/backend/api/requests/pricing', { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error('pricing unavailable'); return r.json() })
      .then(data => {
        if (!active) return
        const f = data.fees || {}
        setParishFees({
          Baptismal: Number(f.baptismal) || 0,
          Confirmation: Number(f.confirmation) || 0,
          Marriage: Number(f.marriage) || 0,
          'Certificate of Ownership': Number(f.ownership) || 0,
          'Land Agreement': Number(f.land_agreement) || 0,
        })
        setUrgentFee(Number(data.urgentFee) || 0)
        setPaymentMode(data.onlinePaymentMode === 'live' ? 'live' : 'test')
        setServiceFees(data.serviceFees || {})
        setCemeteryFees(data.cemeteryFees || {})
        setPricingReady(true)
      })
      .catch(() => { if (active) setPricingReady(false) })
    return () => { active = false }
  }, [])


  const [formData, setFormData] = useState({
    personName: '',
    purpose: '',
    notes: '',
    recordDateHint: '',
    recordDetails: '',
    isUrgent: false,
  })

  const loadRequests = async () => {
    try {
      setRequestsLoading(true)
      setRequestsError('')

      const res = await fetch('/api/backend/api/requests', {
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load requests')
      }

      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to load requests')
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  const performRequestAction = async (id: number, action: 'cancel' | 'hide') => {
    const prompt = action === 'cancel'
      ? 'Cancel this pending certificate request? This cannot be undone.'
      : 'Hide this request from your history? Parish staff will retain official and payment records.'
    if (!window.confirm(prompt)) return
    try {
      const res = await fetch(`/api/backend/api/requests/${id}/${action}`, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Request action failed.')
      await loadRequests()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update request.')
    }
  }

  const loadProfile = async () => {
    try {
      setProfileLoading(true)

      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.user) {
        throw new Error(data.message || 'Failed to load profile')
      }

      const user = data.user as MeResponseUser

      const computedFullName =
        user.fullName?.trim() ||
        [user.firstName, user.middleName, user.surname]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        user.email

      setProfile({
        id: user.id,
        fullName: computedFullName,
        email: user.email,
        phoneNumber: user.phoneNumber ?? null,
        address: user.address ?? null,
      })
    } catch (error) {
      console.warn('Profile load error:', error)
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadProfile()
      void loadRequests()
    })
  }, [])

  useEffect(() => {
    if (activeType !== 'Land Agreement') return
    let active = true
    // Availability is advisory until staff independently approves a reservation.
    const load = async () => {
      setSlotsLoading(true)
      setSlotsError('')
      try {
        const response = await fetch('/api/backend/api/user/cemetery/available-slots', { cache: 'no-store' })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Unable to load cemetery lots.')
        if (!active) return
        const visible = Array.isArray(result.slots) ? result.slots as AvailableCemeterySlot[] : []
        setAvailableSlots(visible)
        setSelectedSlotId(previous => visible.some(slot => slot.id === previous) ? previous : null)
      } catch (error) {
        if (!active) return
        setSlotsError(error instanceof Error ? error.message : 'Unable to load cemetery lots.')
        setAvailableSlots([])
        setSelectedSlotId(null)
      } finally {
        if (active) setSlotsLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [activeType])

  const handleChange = (name: 'personName' | 'purpose' | 'notes' | 'recordDateHint' | 'recordDetails', value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async () => {
    if (!profile) {
      alert('Your account information is still loading. Please try again.')
      return
    }

    if (activeType === 'Land Agreement' && !selectedSlotId) {
      alert('Please choose an available cemetery lot first.')
      return
    }

    if (!formData.personName.trim()) {
      alert('Please enter the name on record.')
      return
    }

    if (!formData.purpose.trim()) {
  alert('Please select a request purpose.')
  return
}

if (
  !PURPOSE_OPTIONS[activeType].includes(formData.purpose)
) {
  alert('Please select a valid purpose for this document.')
  return
}

if (
  formData.purpose === 'Other (Specify in Notes)' &&
  !formData.notes.trim()
) {
  alert('Please specify your purpose in the Notes field.')
  return
}
    try {
      setLoading(true)

      const res = await fetch('/api/backend/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sacramentType: toBackendType(activeType),
          personName: formData.personName.trim(),
          purpose: formData.notes.trim()
            ? `${formData.purpose.trim()} | Notes: ${formData.notes.trim()}`
            : formData.purpose.trim(),
          isUrgent: formData.isUrgent,
          recordDateHint: formData.recordDateHint.trim(),
          recordDetails: activeType === 'Certificate of Ownership' ? formData.recordDetails.trim() : '',
          cemeterySlotId: activeType === 'Land Agreement' ? selectedSlotId : undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.error || 'Request submission failed.')
        return
      }

      setSuccessMsg(`${activeType} request submitted successfully.`)

      setFormData({
        personName: '',
        purpose: '',
        notes: '',
        recordDateHint: '',
        recordDetails: '',
        isUrgent: false,
      })

      await loadRequests()
      setView('history')
      setSelectedSlotId(null)

      window.setTimeout(() => setSuccessMsg(null), 6000)
    } catch (err) {
      console.warn('Submit request error:', err)
      alert('Cannot submit request right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const payMongoCheckout = async (requestId: number) => {
    try {
      const res = await fetch(`/api/backend/api/requests/${requestId}/paymongo-checkout`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'Checkout unavailable.'); return }
      if (!data.checkoutUrl?.startsWith('https://checkout.paymongo.com/')) {
        alert('Invalid payment destination.'); return
      }
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      console.warn('PayMongo checkout error:', error)
      alert('Unable to reach payment checkout.')
    }
  }

  const previewBaseFee = parishFees[activeType]
  const previewUrgentFee = formData.isUrgent ? urgentFee : 0
  const previewTotal = previewBaseFee + previewUrgentFee

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Document Requests
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Request parish certificates, certificates of ownership, or land agreement copies.
        Your registered account information is used automatically for every request.
      </p>

      {pricingReady && (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-navy-mid text-sm">Published Parish Service Fees</h3>
          <p className="mt-1 text-xs text-slate-700">Service fees are separate from certificate-copy fees. These services require staff scheduling; this panel does not initiate online payment.</p>
          <div className="mt-3 grid gap-2 text-xs text-navy-mid sm:grid-cols-2 lg:grid-cols-3">
            <div>Baptism service: <strong>{formatPeso(serviceFees.baptism)}</strong></div>
            <div>Burial service: <strong>{formatPeso(serviceFees.burial)}</strong></div>
            <div>Matrimony service: <strong>{formatPeso(serviceFees.matrimony)}</strong></div>
            <div>Cemetery opening permit: <strong>{formatPeso(cemeteryFees.openingPermit)}</strong></div>
            <div>Perpetual dues: <strong>{formatPeso(cemeteryFees.perpetualDuesPerYear)} / year</strong></div>
          </div>
          <p className="mt-2 text-xs text-slate-700">Baptismal Certificate: {formatPeso(parishFees.Baptismal)} · Confirmation Certificate: {formatPeso(parishFees.Confirmation)}. Other certificate-copy prices require parish confirmation.</p>
        </section>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <i className="ti ti-circle-check text-green-600 text-[18px] mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-display text-green-700 text-[13px] font-semibold mb-0.5">
              Request Submitted Successfully
            </p>
            <p className="font-body text-green-600 text-[13px]">{successMsg}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
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
          type="button"
          onClick={() => {
            void loadRequests()
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
                type="button"
                key={type}
                onClick={() => {
  setActiveType(type)

  setFormData((prev) => ({
    ...prev,
    purpose: '',
  }))
}}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  activeType === type
                    ? 'bg-navy border-navy text-gold'
                    : 'bg-white border-gold/20 text-navy-mid hover:border-gold/40'
                }`}
              >
                <i
                  className={`ti ${REQUEST_TYPE_ICONS[type]} text-[18px] ${
                    activeType === type ? 'text-gold' : 'text-[#7890a6]'
                  }`}
                />
                <span className="font-display text-[12px] tracking-wide">{type}</span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 bg-white border border-gold/20 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gold/10">
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                <i className={`ti ${REQUEST_TYPE_ICONS[activeType]} text-gold text-[18px]`} />
              </div>

              <div>
                <p className="font-display text-navy-mid text-[14px] font-semibold">
                  {activeType} Request
                </p>
                <p className="font-body text-[#6b8caa] text-[12px]">
                  Your requester information comes from your registered account.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="font-display text-navy-mid text-[12px] font-semibold">
                    Requester Information
                  </p>
                  <span className="font-body text-[11px] text-blue-700">
                    From your account
                  </span>
                </div>

                {profileLoading ? (
                  <p className="font-body text-[13px] text-slate-500">
                    Loading your account information...
                  </p>
                ) : profile ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="text-slate-500">Name</p>
                      <p className="text-navy-mid font-semibold">{profile.fullName}</p>
                    </div>

                    <div>
                      <p className="text-slate-500">Email</p>
                      <p className="text-navy-mid break-all">{profile.email}</p>
                    </div>

                    <div>
                      <p className="text-slate-500">Phone</p>
                      <p className="text-navy-mid">
                        {profile.phoneNumber || 'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Address</p>
                      <p className="text-navy-mid">
                        {profile.address || 'Not provided'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="font-body text-[13px] text-red-700">
                      Unable to load your account information. Refresh the page or log in again.
                    </p>
                  </div>
                )}
              </div>

              {urgentFee > 0 && <div className="md:col-span-2">
                <label className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isUrgent}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        isUrgent: e.target.checked,
                      }))
                    }
                    className="mt-1"
                  />

                  <div>
                    <p className="font-display text-orange-800 text-[12px] font-semibold">
                      Urgent Request
                    </p>
                    <p className="font-body text-orange-700 text-[12px] mt-1">
                      Urgent processing adds {formatPeso(urgentFee)} according to the parish fee schedule.
                    </p>
                  </div>
                </label>
              </div>}

              <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                {!pricingReady && <p className="text-sm text-amber-700">Parish fees are unavailable. The final amount must be confirmed by staff before payment.</p>}
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-emerald-900">Document Fee</span>
                  <span className="font-semibold text-emerald-900">
                    {previewBaseFee > 0 ? formatPeso(previewBaseFee) : 'Parish confirmation required'}
                  </span>
                </div>

                <div className="flex justify-between text-[13px] mb-2">
                  <span className="text-emerald-900">Urgent Fee</span>
                  <span className="font-semibold text-emerald-900">
                    {formatPeso(previewUrgentFee)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-emerald-200 pt-2 font-semibold text-emerald-800">
                  <span>Estimated Request Fee</span>
                  <span>{formatPeso(previewTotal)}</span>
                </div>

                <p className="font-body text-[11px] text-emerald-700 mt-2">
                  {paymentMode === 'live' ? 'Final payment is collected securely through the parish PayMongo checkout after approval.' : 'Test checkout mode. No real money is charged; prices must be approved by the parish.'}
                </p>
              </div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  {activeType === 'Certificate of Ownership' ? 'Registered Lot Holder' : activeType === 'Land Agreement' ? 'Applicant Name' : 'Name on Record'} <span className="text-gold">*</span>
                </label>
                <input
                  value={formData.personName}
                  onChange={e => handleChange('personName', e.target.value)}
                  placeholder={activeType === 'Certificate of Ownership' ? 'Name of registered lot holder' : 'Name written on church record'}
                  className={inputCls}
                />
              </div>

              <div>
  <label
    htmlFor="request-purpose"
    className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5"
  >
    Purpose <span className="text-gold">*</span>
  </label>

  <select
    id="request-purpose"
    value={formData.purpose}
    onChange={(e) => handleChange('purpose', e.target.value)}
    className={inputCls}
    required
  >
    <option value="">Select Purpose</option>

    {PURPOSE_OPTIONS[activeType].map((purpose) => (
      <option key={purpose} value={purpose}>
        {purpose}
      </option>
    ))}
  </select>
</div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  {activeType === 'Certificate of Ownership' ? 'Agreement Date / Year (if known)' : 'Approximate Record Date / Year'}
                </label>
                <input
                  type="date"
                  value={formData.recordDateHint}
                  onChange={e => handleChange('recordDateHint', e.target.value)}
                  className={inputCls}
                />
              </div>

              {activeType === 'Land Agreement' && (
                <div className="md:col-span-2 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <label htmlFor="cemetery-available-slot" className="block font-display text-[13px] font-semibold text-navy-mid mb-2">
                    Available Cemetery Lots <span className="text-red-600">*</span>
                  </label>
                  <p className="text-[12px] text-slate-700 mb-3">
                    Choose a lot to inquire about. This does not reserve a lot or confirm a purchase. Burial Admin will verify availability and pricing.
                  </p>
                  {slotsLoading ? <p className="text-[13px]">Loading available lots...</p> : slotsError ? (
                    <p role="alert" className="text-[13px] text-red-700">{slotsError} Refresh the page and try again.</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-[13px] text-amber-800">No lots are currently listed as available. Contact the Burial Office.</p>
                  ) : (
                    <select
                      id="cemetery-available-slot"
                      value={selectedSlotId ?? ''}
                      onChange={event => setSelectedSlotId(event.target.value ? Number(event.target.value) : null)}
                      className={inputCls}
                      required
                    >
                      <option value="">Select a cemetery lot</option>
                      {availableSlots.map(slot => (
                        <option key={slot.id} value={slot.id}>
                          {slot.slotCode} — {slot.section || 'No section'} / {slot.block || 'No block'} / Lot {slot.lotNumber}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedSlotId != null && availableSlots.some(slot => slot.id === selectedSlotId) && (
                    <p className="text-[12px] text-slate-700 mt-3">Selected lot: {availableSlots.find(slot => slot.id === selectedSlotId)?.slotCode}. Pending staff review.</p>
                  )}
                </div>
              )}

              {activeType === 'Certificate of Ownership' && (
                <div>
                  <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                    Lot / Reservation Reference
                  </label>
                  <input
                    value={formData.recordDetails}
                    onChange={e => handleChange('recordDetails', e.target.value)}
                    placeholder="Section, block, lot number, reservation number"
                    className={inputCls}
                  />
                </div>
              )}

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

            <div className="mt-6 pt-4 border-t border-gold/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="font-body text-[12px] text-[#7890a6]">
                Payment becomes available after the parish staff approves the request.
              </p>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || profileLoading || !profile || (activeType === 'Land Agreement' && (slotsLoading || Boolean(slotsError) || !selectedSlotId))}
                className="flex items-center justify-center gap-2 font-display text-[12px] tracking-wider bg-navy text-gold px-5 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ti ti-send text-[14px]" />
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {requestsLoading ? (
            <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
              <i className="ti ti-loader-2 animate-spin text-gold text-3xl mb-3 inline-block" />
              <p className="font-body text-[#7890a6] text-[13px]">Loading your requests...</p>
            </div>
          ) : requestsError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <p className="font-display text-amber-800 text-[13px] font-semibold">Unable to load requests</p>
              <p className="font-body text-amber-700 text-[12px] mt-1">{requestsError}</p>
              <button type="button" onClick={() => void loadRequests()} className="mt-3 bg-navy text-white px-3 py-2 rounded-lg font-display text-[10px] tracking-wider">Retry</button>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
              <i className="ti ti-file-plus text-gold/30 text-5xl mb-3 block" />
              <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
                No requests yet
              </p>
              <p className="font-body text-[#7890a6] text-[13px]">
                This account has no document requests yet.
              </p>
              <button
                type="button"
                onClick={() => setView('form')}
                className="mt-4 font-display text-[11px] tracking-wider text-gold border border-gold/30 px-4 py-2 rounded-lg"
              >
                Make a Request
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map(req => {
                const displayType = toDisplayType(req.sacramentType)
                const canPayOnline =
                  req.paymentStatus !== 'Paid' &&
                  req.totalFee > 0 &&
                  (req.status === 'Approved' || req.status === 'Ready')

                const canDownload =
                  Boolean(req.generatedFile) &&
                  req.status === 'Released' &&
                  req.paymentStatus === 'Paid'

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-xl p-5 border shadow-sm ${
                      req.isUrgent
                        ? 'border-orange-200'
                        : 'border-gold/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                            req.isUrgent
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-gold/10 border-gold/20'
                          }`}
                        >
                          <i
                            className={`ti ${getRequestIcon(req.sacramentType)} ${
                              req.isUrgent ? 'text-orange-600' : 'text-gold'
                            } text-[17px]`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display text-navy-mid text-[13px] font-semibold">
                              {displayType}
                            </p>

                            {req.isUrgent && (
                              <span className="font-display text-[9px] tracking-wider uppercase bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                                Urgent
                              </span>
                            )}
                          </div>

                          <p className="font-body text-[#7890a6] text-[11px] mt-0.5">
                            Ref: IFI-REQ-{req.id.toString().padStart(4, '0')}
                            {req.createdAt ? ` · Submitted ${req.createdAt.slice(0, 10)}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${getStatusStyle(
                            req.status
                          )}`}
                        >
                          {req.status}
                        </span>

                        <span
                          className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${
                            req.paymentStatus === 'Paid'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {req.paymentStatus || 'Unpaid'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gold/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">
                          Name on Record
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">{req.personName}</p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">
                          Priority
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">
                          {req.isUrgent ? 'Urgent' : 'Regular'}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">
                          Total Fee
                        </p>
                        <p className="font-body text-[12px] text-navy-mid font-semibold">
                          {formatPeso(req.totalFee)}
                        </p>
                      </div>

                      <div>
                        <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">
                          Payment
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">
                          {req.paymentStatus || 'Unpaid'}
                          {req.paymentReference ? ` · ${req.paymentReference}` : ''}
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">
                          Purpose
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">{req.purpose}</p>
                      </div>

                      {(req.recordDateHint || req.recordDetails) && (
                        <div className="md:col-span-2">
                          <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">Record Search Details</p>
                          <p className="font-body text-[12px] text-navy-mid">
                            {[req.recordDateHint, req.recordDetails].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <p className="font-display text-[10px] tracking-wider text-[#7890a6] uppercase">
                          Admin Remarks
                        </p>
                        <p className="font-body text-[12px] text-navy-mid">
                          {req.remarks || 'No remarks yet'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gold/10 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        {req.status === 'Pending' && (
                          <p className="font-body text-[12px] text-[#7890a6]">
                            Waiting for parish staff review.
                          </p>
                        )}

                        {req.status === 'Approved' && req.paymentStatus !== 'Paid' && (
                          <p className="font-body text-[12px] text-amber-700">
                            Your request is approved. PayMongo {paymentMode === 'live' ? 'checkout' : 'test checkout'} is available.
                          </p>
                        )}

                        {req.status === 'Approved' && req.paymentStatus === 'Paid' && (
                          <p className="font-body text-[12px] text-green-700">
                            Payment confirmed. Waiting for the parish staff to prepare your document.
                          </p>
                        )}

                        {req.status === 'Ready' && req.paymentStatus !== 'Paid' && (
                          <p className="font-body text-[12px] text-amber-700">
                            Your document is ready, but payment is required before release.
                          </p>
                        )}

                        {req.status === 'Ready' && req.paymentStatus === 'Paid' && (
                          <p className="font-body text-[12px] text-blue-700">
                            Paid and ready. Waiting for the parish staff to release the document.
                          </p>
                        )}

                        {req.status === 'Released' && req.paymentStatus === 'Paid' && (
                          <p className="font-body text-[12px] text-green-700">
                            Your document has been released and is available for download.
                          </p>
                        )}

                        {req.status === 'Cancelled' && (
                          <p className="font-body text-[12px] text-slate-600">You cancelled this unpaid request.</p>
                        )}
                        {req.status === 'Rejected' && (
                          <p className="font-body text-[12px] text-red-600">
                            This request was rejected. Check the admin remarks for details.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {req.status === 'Pending' && req.paymentStatus !== 'Paid' && !req.paymentReference && (
                          <button type="button"
                            onClick={() => void performRequestAction(req.id, 'cancel')}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-display text-[11px] text-red-700 hover:bg-red-100">
                            Cancel Request
                          </button>
                        )}
                        {['Cancelled', 'Rejected', 'Released'].includes(req.status) && (
                          <button type="button"
                            onClick={() => void performRequestAction(req.id, 'hide')}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-display text-[11px] text-slate-700 hover:bg-slate-50"
                            title="Hide from your personal view without deleting the parish record">
                            Hide From My History
                          </button>
                        )}
                        {canPayOnline && (
                          <button
                            type="button"
                            onClick={() => void payMongoCheckout(req.id)}
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-display text-[11px] tracking-wider px-4 py-2 rounded-lg transition-colors"
                          >
                            <i className="ti ti-credit-card text-[14px]" />
                            Pay Online {formatPeso(req.totalFee)}
                          </button>
                        )}

                        {canDownload && req.generatedFile && (
                          <a
                            href={`/api/backend/api/requests/${req.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg"
                          >
                            <i className="ti ti-download text-[13px]" />
                            Download Document
                          </a>
                        )}
                      </div>
                    </div>

                    {req.status === 'Ready' && !req.generatedFile && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="font-body text-[12px] text-red-600">
                          This request is marked Ready, but no document file is attached. Please contact the parish staff.
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

'use client'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import RequestDetails from '@/components/RequestDetails'

import identityConfig from '../../../../config/certificate_identity.json'
import { digitsOnly, isValidPastCalendarDate, isValidPersonName, philippineToday, sanitizePersonName } from '@/lib/fieldInput'
import { useEffect, useState } from 'react'
import { REQUEST_ICONS, STATUS_STYLE, inputCls } from '../data/ui'

type UserProfile = {
  id: number
  fullName: string
  email: string
  phoneNumber: string | null
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

// Parents identify the person on the church record, not the account holder.
const SACRAMENTAL_TYPES = new Set<RequestType>(['Baptismal', 'Confirmation', 'Marriage'])
const NEW_LAND_AGREEMENT_PURPOSE = 'Apply for Cemetery Lot Agreement'

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
  const { toast, confirmAction } = useFeedback()
  const [paymentNotice,setPaymentNotice] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const id = params.get('requestId')
    if (!id || !/^\d+$/.test(id)) return
    if (params.get('checkout')==='cancelled') { setPaymentNotice('Checkout cancelled.'); return }
    if (params.get('checkout')!=='returned') return
    const abort = new AbortController()
    setPaymentNotice('Checking the payment with PayMongo…')
    fetch('/api/backend/api/requests/'+id+'/payment-result',{method:'POST',signal:abort.signal})
      .then(async res => {
        const data = await res.json()
        if (abort.signal.aborted) return
        setPaymentNotice(res.ok && data.paymentStatus==='Paid' ? 'Payment confirmed for request #'+id : 'Payment confirmation pending. Refresh tracking before paying again.')
        if (res.ok && data.paymentStatus==='Paid') void loadRequests()
      }).catch(()=>{if (!abort.signal.aborted) setPaymentNotice('Payment confirmation unavailable. Refresh tracking before paying again.')})
    return () => abort.abort()
  }, [])
  const [activeType, setActiveType] = useState<RequestType>('Baptismal')
  const [view, setView] = useState<'form' | 'history'>('history')
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
        setPaymentMode(data.onlinePaymentMode === 'live' ? 'live' : 'test')
        setServiceFees(data.serviceFees || {})
        setCemeteryFees(data.cemeteryFees || {})
        setPricingReady(true)
      })
      .catch(() => { if (active) setPricingReady(false) })
    return () => { active = false }
  }, [])


  const [formData, setFormData] = useState({
    personName: '', motherFullName: '', fatherFullName: '',
    purpose: '',
    notes: '',
    recordDateHint: '',
    recordDetails: '',
    isUrgent: false,
  })

  const isSacrament = SACRAMENTAL_TYPES.has(activeType)
  const needsParentNames = isSacrament && activeType !== 'Marriage'
  const [identity, setIdentity] = useState<Record<string,string>>({})
  const [unredacted,setUnredacted] = useState(false)
  const [proof,setProof] = useState<File|null>(null)
  const [identityMessage,setIdentityMessage] = useState('')
  const specs: {key:string;label:string;kind:string;required:boolean;options?:string[]}[] =
    identityConfig[toBackendType(activeType) as keyof typeof identityConfig] || []
  function clearIdentity() {
    setIdentity({}); setProof(null); setUnredacted(false); setIdentityMessage('')
  }
  const needsAvailableCemeteryLot = activeType === 'Land Agreement' &&
    formData.purpose === NEW_LAND_AGREEMENT_PURPOSE

  const [catalog,setCatalog] = useState<Record<string,string[]>>({})
  useEffect(()=>{ fetch("/api/portal-config").then(r=>r.ok?r.json():null).then(d=>{if(d?.purposes)setCatalog(d.purposes)}).catch(()=>{}) },[])
  const purposes = catalog[toBackendType(activeType)] || PURPOSE_OPTIONS[activeType]
  const [claimId,setClaimId] = useState('')
  const [historyPage,setHistoryPage] = useState(1)
  const [historyPages,setHistoryPages] = useState(1)
  const loadRequests = async () => {
    try {
      setRequestsLoading(true)
      setRequestsError('')

      const res = await fetch('/api/backend/api/requests?page='+historyPage, {
        cache: 'no-store',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load requests')
      }

      setHistoryPage(data.page); setHistoryPages(data.pages)
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to load requests')
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => { void loadRequests() }, [historyPage])

  const performRequestAction = async (id: number, action: 'cancel' | 'hide') => {
    const prompt = action === 'cancel'
      ? 'Cancel this pending certificate request? This cannot be undone.'
      : 'Hide this request from your history? Parish staff will retain official and payment records.'
    if (!await confirmAction(prompt)) return
    try {
      const res = await fetch(`/api/backend/api/requests/${id}/${action}`, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Request action failed.')
      await loadRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update request.')
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
    })
  }, [])

  useEffect(() => {
    if (!needsAvailableCemeteryLot) return
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
  }, [needsAvailableCemeteryLot])

  const handleChange = (name: 'motherFullName' | 'fatherFullName' | 'personName' | 'purpose' | 'notes' | 'recordDateHint' | 'recordDetails', value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: ['personName', 'motherFullName', 'fatherFullName'].includes(name)
        ? sanitizePersonName(value) : value,
    }))
  }

  const handleSubmit = async () => {
    if (!profile) {
      toast.warning('Your account information is still loading. Please try again.')
      return
    }

    if (needsAvailableCemeteryLot && !selectedSlotId) {
      toast.warning('Please choose an available cemetery lot first.')
      return
    }

    if (isSacrament) {
      const missing = specs.find(field => field.required && !identity[field.key]?.trim())
      if (missing) { setIdentityMessage('Enter ' + missing.label + '.'); return }
      for (const field of specs) {
        const input = (identity[field.key] || '').trim()
        if (!input) continue
        if (field.kind === 'name' && !isValidPersonName(input)) {
          setIdentityMessage('Enter a valid name for ' + field.label + '.'); return
        }
        if ((field.kind === 'date' || field.kind === 'yearDate') && !isValidPastCalendarDate(input)) {
          setIdentityMessage('Select a valid past date for ' + field.label + '.'); return
        }
        if (['page', 'line'].includes(field.key) && !/^\d+$/.test(input)) {
          setIdentityMessage('Use numbers only for ' + field.label + '.'); return
        }
      }
      if (unredacted && (!proof || proof.size > 3*1024*1024)) {
        setIdentityMessage('Attach a PDF, JPG or PNG up to 3 MB for an unredacted copy.'); return
      }
    }
    if (needsParentNames) {
      for (const name of [formData.motherFullName, formData.fatherFullName]) {
        const value = name.trim()
        if (!isValidPersonName(value)) {
          setIdentityMessage('Enter valid full names for both parents.')
          toast.warning('Enter both parents’ full names of the person on the record using letters, spaces, periods, hyphens or apostrophes.')
          return
        }
      }
    }
    if (!isValidPersonName(formData.personName)) {
      setIdentityMessage('Enter the full name on the record.')
      toast.warning('Please enter the name on record.')
      return
    }

    if (formData.recordDateHint && !isValidPastCalendarDate(formData.recordDateHint)) {
      toast.warning('Choose a valid past date from the calendar.')
      return
    }

    if (!formData.purpose.trim()) {
  toast.warning('Please select a request purpose.')
  return
}

if (
  !purposes.includes(formData.purpose)
) {
  toast.warning('Please select a valid purpose for this document.')
  return
}

if (
  formData.purpose === 'Other (Specify in Notes)' &&
  !formData.notes.trim()
) {
  toast.warning('Please specify your purpose in the Notes field.')
  return
}
    try {
      setLoading(true)

      let proofBase64: string | undefined
      if (isSacrament && unredacted && proof) {
        proofBase64 = await new Promise<string>((resolve,reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('Cannot read proof file'))
          reader.readAsDataURL(proof)
        })
      }
      const res = await fetch('/api/backend/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: isSacrament ? {...identity,unredacted} : undefined,
          proofBase64,
          sacramentType: toBackendType(activeType),
          personName: formData.personName.trim(),
          motherFullName: needsParentNames ? formData.motherFullName.trim() : undefined,
          fatherFullName: needsParentNames ? formData.fatherFullName.trim() : undefined,
          claimId: claimId ? Number(claimId) : undefined,
          purpose: formData.notes.trim()
            ? `${formData.purpose.trim()} | Notes: ${formData.notes.trim()}`
            : formData.purpose.trim(),
          isUrgent: false,
          recordDateHint: formData.recordDateHint.trim(),
          recordDetails: ['Certificate of Ownership', 'Land Agreement'].includes(activeType)
            ? formData.recordDetails.trim() : '',
          cemeterySlotId: needsAvailableCemeteryLot ? selectedSlotId : undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setIdentityMessage(data.error || 'Request submission failed.')
        toast.error(data.error || 'Request submission failed.')
        return
      }

      clearIdentity()
      setSuccessMsg(`${activeType} request submitted successfully.`)

      setFormData({
        personName: '', motherFullName: '', fatherFullName: '',
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
      toast.error('Cannot submit request right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const payMongoCheckout = async (requestId: number) => {
    try {
      const res = await fetch(`/api/backend/api/requests/${requestId}/paymongo-checkout`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Checkout unavailable.'); return }
      if (!data.checkoutUrl?.startsWith('https://checkout.paymongo.com/')) {
        toast.error('Invalid payment destination.'); return
      }
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      console.warn('PayMongo checkout error:', error)
      toast.error('Unable to reach payment checkout.')
    }
  }

  const previewBaseFee = parishFees[activeType]
  const previewTotal = previewBaseFee

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

      {paymentNotice && <p role="status" className="role-card">{paymentNotice}</p>}
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
  clearIdentity()
  setActiveType(type)

  setFormData((prev) => ({
    ...prev,
    purpose: '',
    personName: '',
    motherFullName: '',
    fatherFullName: '',
    recordDetails: '',
    recordDateHint: '',
  }))
  setSelectedSlotId(null)
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


                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="font-body text-[13px] text-red-700">
                      Unable to load your account information. Refresh the page or log in again.
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                {!pricingReady && <p className="text-sm text-amber-700">Parish fees are unavailable. The final amount must be confirmed by staff before payment.</p>}
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-emerald-900">Document Fee</span>
                  <span className="font-semibold text-emerald-900">
                    {previewBaseFee > 0 ? formatPeso(previewBaseFee) : 'Parish confirmation required'}
                  </span>
                </div>

                <div className="flex justify-between border-t border-emerald-200 pt-2 font-semibold text-emerald-800">
                  <span>Estimated Request Fee</span>
                  <span>{pricingReady && previewTotal > 0 ? formatPeso(previewTotal) : 'Parish confirmation required'}</span>
                </div>

                <p className="font-body text-[11px] text-emerald-700 mt-2">
                  {paymentMode === 'live' ? 'Final payment is collected securely through the parish PayMongo checkout after approval.' : 'Test checkout mode. No real money is charged; prices must be approved by the parish.'}
                </p>
              </div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  {activeType === 'Certificate of Ownership' ? 'Registered Lot Holder' : activeType === 'Land Agreement' ? 'Applicant / Name on Agreement' : activeType === 'Marriage' ? 'Groom’s full name' : 'Full name on the church record'} <span className="text-gold">*</span>
                </label>
                <input
                  value={formData.personName}
                  maxLength={150} required autoComplete="off"
                  onChange={e => handleChange('personName', e.target.value)}
                  placeholder={activeType === 'Certificate of Ownership' ? 'Name of registered lot holder' : activeType === 'Land Agreement' ? 'Name of applicant or agreement holder' : 'Name written on church record'}
                  className={inputCls}
                />
              </div>

              {isSacrament && <section className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                {specs.map(field => <label key={field.key}>{field.label} {field.required ? '*' : '(optional)'}
                  {field.options ? <select className={inputCls} value={identity[field.key]||''} onChange={e=>setIdentity({...identity,[field.key]:e.target.value})}>
                    <option value="">Select relationship</option>{field.options.map(v=><option key={v}>{v}</option>)}</select>
                  : <input required={field.required} maxLength={180}
                    type={field.kind==='date' || field.kind==='yearDate' ? 'date' : 'text'}
                    inputMode={['page', 'line'].includes(field.key) ? 'numeric' : undefined}
                    max={field.kind==='date' || field.kind==='yearDate' ? philippineToday() : undefined}
                    className={inputCls} value={identity[field.key]||''}
                    onChange={e => setIdentity(previous => ({
                      ...previous, [field.key]:
                        field.kind === 'name' ? sanitizePersonName(e.target.value)
                        : ['page', 'line'].includes(field.key) ? digitsOnly(e.target.value, 12)
                        : e.target.value,
                    }))}/>}
                </label>)}
                <label><input type="checkbox" checked={unredacted} onChange={e=>{setUnredacted(e.target.checked);setProof(null)}}/> Request an unredacted copy</label>
                {unredacted && <label>Valid ID or authorization document (up to 3 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setProof(e.target.files?.[0]||null)}/></label>}
                <p className="sm:col-span-2 text-sm text-slate-600">
                  No extra email code is needed. Parish staff will verify the matching record before processing your request.
                </p>
                {identityMessage && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{identityMessage}</p>}
              </section>}
              {needsParentNames && (
                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-800">
                    Parents of the person named on the church record
                  </p>
                  <p className="mb-3 text-xs text-slate-600">
                    These names help staff distinguish similar records. They are not account profile details.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['motherFullName', 'fatherFullName'] as const).map(key => (
                      <label key={key} className="block text-sm font-medium text-slate-800">
                        {key === 'motherFullName' ? 'Mother’s Full Name (including maiden name)' : 'Father’s Full Name'} *
                        <input className={`${inputCls} mt-1.5`} required maxLength={150}
                          autoComplete="off" value={formData[key]}
                          onChange={e => handleChange(key, e.target.value)} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
  {process.env.NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS === 'enabled' && activeType !== 'Land Agreement' && <label className="block mb-3">Approved claim number for a relative
  <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} className={inputCls} value={claimId} onChange={e=>setClaimId(digitsOnly(e.target.value, 10))}/><a className="underline" href="/claims">Manage relationship claims</a></label>}
<label
    htmlFor="request-purpose"
    className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5"
  >
    Purpose <span className="text-gold">*</span>
  </label>

  <select
    id="request-purpose"
    value={formData.purpose}
    onChange={(e) => {
      handleChange('purpose', e.target.value)
      setSelectedSlotId(null)
    }}
    className={inputCls}
    required
  >
    <option value="">Select Purpose</option>

    {purposes.map((purpose) => (
      <option key={purpose} value={purpose}>
        {purpose}
      </option>
    ))}
  </select>
</div>

              <div>
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  {activeType === 'Certificate of Ownership' ? 'Approximate Agreement Date (if known)' : 'Approximate Record Date (if known)'}
                </label>
                <input
                  type="date"
                  max={philippineToday()}
                  value={formData.recordDateHint}
                  onChange={e => handleChange('recordDateHint', e.target.value)}
                  className={inputCls}
                />
              </div>

              {needsAvailableCemeteryLot && (
                <div className="md:col-span-2 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <label htmlFor="cemetery-available-slot" className="block font-display text-[13px] font-semibold text-navy-mid mb-2">
                    Available Cemetery Lots <span className="text-red-600">*</span>
                  </label>
                  <p className="text-[12px] text-slate-700 mb-3">
                    Select a lot for an inquiry only. This does not reserve a lot or confirm a purchase. Church Staff will independently verify availability and any agreement terms.
                  </p>
                  {slotsLoading ? <p className="text-[13px]">Loading available lots...</p> : slotsError ? (
                    <p role="alert" className="text-[13px] text-red-700">{slotsError} Refresh the page and try again.</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-[13px] text-amber-800">No lots are currently listed as available. Contact the parish office.</p>
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

              {['Certificate of Ownership', 'Land Agreement'].includes(activeType) && !needsAvailableCemeteryLot && (
                <div>
                  <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                    {activeType === 'Land Agreement' ? 'Agreement / Lot Reference (if known)' : 'Lot / Reservation Reference'}
                  </label>
                  <input
                    value={formData.recordDetails} maxLength={500}
                    onChange={e => handleChange('recordDetails', e.target.value)}
                    placeholder="Agreement number, section, block, or lot reference (if known)"
                    className={inputCls}
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={3} maxLength={180}
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
                disabled={loading || profileLoading || !profile || (needsAvailableCemeteryLot && (slotsLoading || Boolean(slotsError) || !selectedSlotId))}
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">Track actual parish request and payment records here. No SMS service is needed to view updates.</p>
            <button type="button" disabled={requestsLoading} onClick={() => void loadRequests()}
              className="min-h-11 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50">
              <i aria-hidden="true" className="ti ti-refresh mr-2" />{requestsLoading ? 'Updating…' : 'Refresh tracking'}
            </button>
          </div>
          <nav className="parish-pager" aria-label="Request history pages"><button disabled={requestsLoading || historyPage<=1} onClick={()=>setHistoryPage(historyPage-1)}>Previous</button><span>Page {historyPage} of {historyPages}</span><button disabled={requestsLoading || historyPage>=historyPages} onClick={()=>setHistoryPage(historyPage+1)}>Next</button></nav>
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
                            Requester: {req.requesterName || 'Unavailable'} · IFI-REQ-{req.id.toString().padStart(4, '0')}
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

                    <details><summary>Request details</summary><RequestDetails request={req} documentType={displayType} /></details>

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

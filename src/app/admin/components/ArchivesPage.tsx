'use client'

import { useEffect, useRef, useState } from 'react'
import { inputCls } from '../data/ui'
import TemplateDataFields, { type TemplateRecordData } from './TemplateDataFields'

type ArchiveDocument = {
  id: number
  personName: string
  sacramentType: string
  parish: string
  priest: string
  dateOfRecord: string
  certificateNumber: string
  documentType: string
  filename: string
  filepath: string
  filledTemplateUrl?: string | null
  originalScanUrl?: string | null
  originalScanFilename?: string | null
  isFilledPrimary?: boolean
  uploadedBy: string
}

const ARCHIVE_TYPES = [
  { label: 'Baptismal', value: 'baptismal', icon: 'ti-droplet' },
  { label: 'Confirmation', value: 'confirmation', icon: 'ti-shield-check' },
  { label: 'Marriage', value: 'marriage', icon: 'ti-rings' },
]

export default function ArchivesPage() {
  const [activeTab, setActiveTab] = useState('baptismal')
  const [search, setSearch] = useState('')
  const [documents, setDocuments] = useState<ArchiveDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [recordData, setRecordData] = useState<TemplateRecordData>({})

  const [form, setForm] = useState({
  person_name: '',
  sacrament_type: 'baptismal',
  parish: '',
  priest: '',
  date_of_record: '',
  document_type: 'Scanned Certificate',
})

  const [file, setFile] = useState<File | null>(null)
  const [runOcr, setRunOcr] = useState(true)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [ocrSuggestions, setOcrSuggestions] = useState<Record<string, string>>({})
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([])
  const [ocrReviewed, setOcrReviewed] = useState(false)
  const ocrRequestCounter = useRef(0)
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState<string | null>(null)
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false)
  const [templatePreviewError, setTemplatePreviewError] = useState('')
  const previewUrlRef = useRef<string | null>(null)
  const previewVersionRef = useRef(0)

  const discardTemplatePreview = () => {
    previewVersionRef.current += 1
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setTemplatePreviewUrl(null)
    setTemplatePreviewError('')
  }

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const previewFilledTemplate = async () => {
    discardTemplatePreview()
    const hasReviewedOrEnteredFields = Object.values(recordData).some(value =>
      Array.isArray(value) ? value.some(item => String(item).trim()) :
      typeof value === 'object' && value !== null
        ? Object.values(value).some(nested => String(nested || '').trim())
        : Boolean(String(value || '').trim())
    )
    if (!hasReviewedOrEnteredFields) {
      setTemplatePreviewError(
        'No document details are available yet. Fix the OCR error and click Preview OCR, or enter the Official Form Data manually before previewing.'
      )
      return
    }
    const revision = previewVersionRef.current
    setTemplatePreviewLoading(true)
    try {
      const res = await fetch('/api/backend/api/archive/template-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sacrament_type: form.sacrament_type,
          person_name: form.person_name,
          date_of_record: form.date_of_record,
          record_data: recordData,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Could not generate the filled template.')
      }
      const blob = await res.blob()
      if (revision !== previewVersionRef.current) return
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setTemplatePreviewUrl(url)
    } catch (error) {
      if (revision === previewVersionRef.current) {
        setTemplatePreviewError(error instanceof Error ? error.message : 'Template preview failed.')
      }
    } finally {
      setTemplatePreviewLoading(false)
    }
  }

  const loadDocuments = async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/backend/api/archive/documents?scope=main')

      if (!res.ok) {
        throw new Error('Failed to load archive documents')
      }

      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (err) {
      console.warn('Archive load error:', err)
      alert('Cannot load archive records. The parish backend service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadDocuments())
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    discardTemplatePreview()
    setOcrReviewed(false)
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      alert('Please upload a scanned PDF or image.')
      return
    }
    if (!ocrReviewed) {
      alert('Review the OCR-populated form against the original scan and tick the review checkbox before saving.')
      return
    }

    const formData = new FormData()

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value)
    })

    formData.append('file', file)
    formData.append('runOcr', runOcr ? 'true' : 'false')
    formData.append('record_data', JSON.stringify(recordData))
    formData.append('review_confirmed', ocrReviewed ? 'true' : 'false')

    try {
      const res = await fetch('/api/backend/api/archive/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Upload failed')
        return
      }

      alert('Archive saved: the filled official-template DRAFT PDF is the primary document. The original scan is retained separately.')

      setForm({
  person_name: '',
  sacrament_type: activeTab,
  parish: '',
  priest: '',
  date_of_record: '',
  document_type: 'Scanned Certificate',
})

      discardTemplatePreview()
      setRecordData({})
      setFile(null)
      setOcrText('')
      setOcrSuggestions({})
      setOcrWarnings([])
      setOcrReviewed(false)
      setShowForm(false)
      await loadDocuments()
    } catch (err) {
      console.warn('Archive upload error:', err)
      alert('Upload failed. The parish backend service is unavailable.')
    }

  }

// OCR processing starts automatically when staff selects a new scan.
// Suggestions fill only *empty* fields; a staff member must review them.
const previewOcr = async (selectedFile: File) => {
  const requestIndex = ++ocrRequestCounter.current
  const submittedCategory = form.sacrament_type
  const formData = new FormData()
  formData.append('file', selectedFile)
  formData.append('sacrament_type', submittedCategory)
  try {
    setOcrLoading(true)
    const res = await fetch('/api/backend/api/archive/ocr-preview', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    if (requestIndex !== ocrRequestCounter.current) return
    if (!res.ok) {
      setOcrWarnings([data.error || 'OCR preview failed. Enter official fields manually.'])
      return
    }
    const extracted = (data.recordData || {}) as TemplateRecordData
    const archive = (data.archiveFields || {}) as Record<string, string>
    setOcrText(data.text || '')
    setOcrSuggestions(data.suggestions || {})
    setOcrWarnings(Array.isArray(data.warnings) ? data.warnings : [])
    setOcrReviewed(false)

    // Never overwrite an existing staff-entered value.
    discardTemplatePreview()
    setRecordData(previous => {
      const next: TemplateRecordData = { ...previous }
      for (const [key, val] of Object.entries(extracted)) {
        if (!val) continue
        if (key === 'husband' || key === 'wife') {
          const nameKey = key as 'husband' | 'wife'
          const existing = previous[nameKey] || {}
          const suggested = val as Record<string, string>
          next[nameKey] = {
            ...suggested,
            ...Object.fromEntries(Object.entries(existing).filter(([, v]) => !!v)),
          }
        } else {
          const recordKey = key as keyof TemplateRecordData
          // This assignment operates on the object key at runtime; the values
          // originate from the server parser's narrow typed form schema.
          if (!previous[recordKey] || (Array.isArray(previous[recordKey]) && previous[recordKey].length === 0)) {
            (next as unknown as Record<string, unknown>)[key] = val
          }
        }
      }
      return next
    })
    setForm(previous => ({
      ...previous,
      person_name: previous.person_name || archive.person_name || '',
      date_of_record: previous.date_of_record || archive.date_of_record || '',
      parish: previous.parish || archive.parish || '',
      priest: previous.priest || archive.priest || '',
    }))
  } catch (error) {
    if (requestIndex !== ocrRequestCounter.current) return
    console.warn('OCR preview request failed:', error)
    setOcrWarnings(['OCR service is unavailable. The form can still be filled manually.'])
  } finally {
    if (requestIndex === ocrRequestCounter.current) setOcrLoading(false)
  }
}

const selectScannedFile = (selected: File | null) => {
  discardTemplatePreview()
  ocrRequestCounter.current += 1
  setFile(selected)
  setOcrText('')
  setOcrSuggestions({})
  setOcrWarnings([])
  setOcrReviewed(false)
  if (selected && runOcr) void previewOcr(selected)
}

const deleteDocument = async (id: number) => {
  const confirmDelete = confirm('Move this document to Recycle Bin?')

  if (!confirmDelete) {
    return
  }

  try {
    const res = await fetch(`/api/backend/api/archive/documents/${id}/delete`, {
      method: 'PATCH',
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error || 'Failed to delete document.')
      return
    }

    alert('Document moved to Recycle Bin.')
    await loadDocuments()
  } catch (err) {
    console.warn('Delete document error:', err)
    alert('Failed to delete document. The parish backend service is unavailable.')
  }
}

const makeFilledTemplatePrimary = async (record: ArchiveDocument) => {
  if (!confirm(`Convert ${record.personName}'s existing archive to use the filled IFI template PDF as its primary document? The scanned original will be preserved.`)) return
  try {
    const res = await fetch(`/api/backend/api/archive/documents/${record.id}/promote-filled-template`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || 'Could not update the primary archive document.')
      return
    }
    await loadDocuments()
    alert('The filled IFI template PDF is now the primary archive document. The original scan remains available.')
  } catch (error) {
    console.error('Archive primary PDF promotion error:', error)
    alert('Could not contact the parish backend. No change was confirmed.')
  }
}

const records = documents.filter(doc =>
  doc.sacramentType === activeTab &&
  (
    doc.personName?.toLowerCase().includes(search.toLowerCase()) ||
    doc.certificateNumber?.toLowerCase().includes(search.toLowerCase()) ||
    doc.filename?.toLowerCase().includes(search.toLowerCase())
  )
)

  const countByType = (type: string) =>
    documents.filter(doc => doc.sacramentType === type).length

  const activeLabel =
    ARCHIVE_TYPES.find(type => type.value === activeTab)?.label || 'Archive'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-navy-mid text-xl font-semibold">
          Digital Church Archives
        </h2>

        <button
          onClick={() => {
            discardTemplatePreview()
            setForm(prev => ({
              ...prev,
              sacrament_type: activeTab,
            }))
            setRecordData({})
            setShowForm(!showForm)
          }}
          className="flex items-center gap-1.5 font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg"
        >
          <i className="ti ti-plus text-[13px]" />
          Add Archive Record
        </button>
      </div>

      <p className="font-body text-[#6b8caa] text-[14px] mb-5">
        Store scanned church records with metadata, categorization, and searchable archive retrieval.
      </p>

      {showForm && (
        <form
          onSubmit={handleUpload}
          className="bg-white border border-gold/20 rounded-xl p-5 mb-6"
        >
          <p className="font-display text-navy-mid text-[13px] font-semibold mb-4">
            Encode and Upload Church Record
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Full Name *
              </label>
              <input
                name="person_name"
                value={form.person_name}
                onChange={handleChange}
                required
                placeholder="Name on record"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Sacrament Type *
              </label>
              <select
  name="sacrament_type"
  value={form.sacrament_type}
  onChange={handleChange}
  className={inputCls}
>
  <option value="baptismal">Baptismal Certificate</option>
  <option value="confirmation">Confirmation Certificate</option>
  <option value="marriage">Marriage Certificate</option>
</select>
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Date of Record
              </label>
              <input
                type="date"
                name="date_of_record"
                value={form.date_of_record}
                onChange={handleChange}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Parish
              </label>
              <input
                name="parish"
                value={form.parish}
                onChange={handleChange}
                placeholder="IFI Maragondon"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Priest
              </label>
              <input
                name="priest"
                value={form.priest}
                onChange={handleChange}
                placeholder="Fr. Name"
                className={inputCls}
              />
            </div>


            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Document Type
              </label>
              <input
                name="document_type"
                value={form.document_type}
                onChange={handleChange}
                placeholder="Scanned Certificate"
                className={inputCls}
              />
            </div>

          <div>
  <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
    Certificate Number
  </label>
  <div className="font-body text-[#6b8caa] text-[12px] border border-gold/20 rounded-lg px-3 py-2 bg-gold/5">
    Auto-generated after saving
  </div>
</div>

            <TemplateDataFields
              sacramentType={form.sacrament_type}
              value={recordData}
              onChange={next => {
                discardTemplatePreview()
                setOcrReviewed(false)
                setRecordData(next)
              }}
            />

            <div className="md:col-span-3">
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Upload Scanned File *
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => selectScannedFile(e.target.files?.[0] || null)}
                required
                className={inputCls}
              />
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 font-body text-[12px] text-slate-600">
                  <input type="checkbox" checked={runOcr} onChange={e => setRunOcr(e.target.checked)} />
                  Run OCR on uploaded scan
                </label>
                <button
                  type="button"
                  onClick={() => file && void previewOcr(file)}
                  disabled={!file || ocrLoading}
                  className="font-display text-[10px] tracking-wider border border-blue-200 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {ocrLoading ? 'Reading scan...' : 'Preview OCR'}
                </button>
                <button
                  type="button"
                  onClick={() => void previewFilledTemplate()}
                  disabled={templatePreviewLoading || ocrLoading}
                  className="font-display text-[10px] tracking-wider border border-emerald-300 text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {templatePreviewLoading ? 'Generating template...' : 'Preview Filled Official Template'}
                </button>
              </div>
              {templatePreviewError && (
                <p role="alert" className="font-body text-[12px] text-red-700 mt-2">{templatePreviewError}</p>
              )}
              {templatePreviewUrl && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-display text-[11px] font-semibold text-emerald-900">Filled parish template — DRAFT PREVIEW</p>
                    <a href={templatePreviewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline text-[12px]">Open PDF</a>
                  </div>
                  <p className="font-body text-[12px] text-slate-700 mb-2">
                    This is a temporary PDF created from the fields above, using your original template image. It is not an official issued certificate. Check all names and dates before saving.
                  </p>
                  <iframe title="Filled official form PDF preview" src={templatePreviewUrl} className="w-full h-[540px] bg-white rounded-md border border-emerald-100" />
                </div>
              )}
              <label className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-body text-[12px] text-blue-900">
                <input type="checkbox" checked={ocrReviewed} onChange={e => setOcrReviewed(e.target.checked)} />
                I have compared every completed Official Form Data field against the original scan and corrected any errors before saving. This is an archival draft, not an issued certificate.
              </label>
              {ocrLoading && <p className="font-body text-[12px] text-blue-700 mt-2">Extracting text and matching official form fields…</p>}
              {ocrWarnings.length > 0 && (
                <div role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  {ocrWarnings.map((warning, index) => <p key={index} className="font-body text-[11px] text-amber-800">{warning}</p>)}
                </div>
              )}
              {(ocrText || Object.keys(ocrSuggestions).length > 0) && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="font-display text-[10px] tracking-wider text-blue-800 mb-1">OCR PREVIEW — VERIFY BEFORE USING</p>
                  <p className="font-body text-[11px] text-blue-800 mb-2">
                    Recognized fields were placed in the official form above wherever a field was blank. Check spelling, dates, and names against the scanned original.
                  </p>
                  <p className="font-body text-[11px] text-slate-600 whitespace-pre-wrap max-h-32 overflow-auto">
                    {ocrText || 'No text recognized.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button className="font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg">
              Save to Archive
            </button>

            <button
              type="button"
              onClick={() => { discardTemplatePreview(); setShowForm(false) }}
              className="font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/20 px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {ARCHIVE_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => {
              discardTemplatePreview()
              setActiveTab(type.value)
              setForm(prev => ({
                ...prev,
                sacrament_type: type.value,
              }))
              setRecordData({})
              selectScannedFile(null)
            }}
            className={`flex items-center gap-2 font-display text-[11px] tracking-wider px-4 py-2 rounded-lg border transition-all ${
              activeTab === type.value
                ? 'bg-navy text-gold border-navy'
                : 'bg-white text-navy-mid border-gold/20'
            }`}
          >
            <i className={`ti ${type.icon} text-[13px]`} />
            {type.label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold">
              {countByType(type.value)}
            </span>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#9ab0c4] text-[15px]" />
        <input
          type="text"
          placeholder="Search by name, certificate number, or filename..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`pl-9 pr-4 py-2.5 ${inputCls}`}
        />
      </div>

      <div className="bg-white border border-gold/20 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold/10 bg-gold/5">
              {['No.', 'Certificate No.', 'Name', 'Date', 'Priest', 'File', 'Actions'].map(h => (
                <th
                  key={h}
                  className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] text-left px-5 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
                  Loading archive records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
                  No {activeLabel.toLowerCase()} records found.
                </td>
              </tr>
            ) : (
              records.map((record, index) => (
                <tr key={record.id} className="border-b border-gold/10 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-display text-navy-mid text-[12px] font-semibold">
                      {index + 1}
                    </p>
                    <p className="font-body text-[#9ab0c4] text-[10px]">
                      Archive ID: {record.id}
                    </p>
                  </td>

                  <td className="px-5 py-3 font-display text-gold text-[11px] tracking-wider">
                    {record.certificateNumber || 'N/A'}
                  </td>

                  <td className="px-5 py-3 font-body text-navy-mid text-[13px]">
                    {record.personName}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px]">
                    {record.dateOfRecord || 'No date'}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px]">
                    {record.priest || 'N/A'}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px]">
                    {record.filledTemplateUrl ? (
                      <div className="flex flex-col gap-1.5">
                        <a
                          href={record.filledTemplateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline font-semibold"
                          title="Completed IFI template; archival draft, not an issued certificate"
                        >
                          {record.isFilledPrimary ? 'Primary: Filled IFI Template (PDF Draft)' : 'Preview Filled IFI Template (PDF Draft)'}
                        </a>
                        {record.originalScanUrl && (
                          <a
                            href={record.originalScanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#6b8caa] underline"
                            title="Unmodified scanned source document"
                          >
                            Original Scan ({record.originalScanFilename || 'source file'})
                          </a>
                        )}
                        {!record.isFilledPrimary && (
                          <button
                            type="button"
                            onClick={() => void makeFilledTemplatePrimary(record)}
                            className="text-left text-emerald-700 underline font-semibold"
                            title="One-time conversion of an older scanned-primary archive; preserves the original"
                          >
                            Make Filled Template Primary
                          </button>
                        )}
                      </div>
                    ) : (
                      <a href={`/api/backend/files/${record.filepath}`} target="_blank" rel="noopener noreferrer" className="underline">
                        {record.filename}
                      </a>
                    )}
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={record.filledTemplateUrl || `/api/backend/files/${record.filepath}`}
                        title="View filled IFI template"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-gold/20 text-gold bg-gold/5"
                      >
                        <i className="ti ti-eye text-[14px]" />
                      </a>

                      <button
                        onClick={() => window.open(record.filledTemplateUrl || `/api/backend/files/${record.filepath}`, '_blank')}
                        className="p-1.5 rounded-lg border border-gold/20 text-[#6b8caa]"
                        title="Open PDF for printing"
                      >
                        <i className="ti ti-printer text-[14px]" />
                      </button>
                      <a
                        href={record.filledTemplateUrl || `/api/backend/files/${record.filepath}`}
                        download={`${record.certificateNumber || record.id}_ARCHIVAL_DRAFT.pdf`}
                        className="p-1.5 rounded-lg border border-gold/20 text-[#6b8caa]"
                        title="Download completed template draft"
                      >
                        <i className="ti ti-download text-[14px]" />
                      </a>

                    <button
  onClick={() => deleteDocument(record.id)}
  className="p-1.5 rounded-lg border border-red-200 text-red-500 bg-red-50"
  title="Move to Recycle Bin"
>
  <i className="ti ti-trash text-[14px]" />
</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-gold/5 border border-gold/20 rounded-xl p-4">
        <p className="font-body text-[12px] text-[#4a6a8a] leading-relaxed">
          <span className="font-display text-navy-mid">Note:</span>{' '}
          The visible <span className="font-display">No.</span> restarts per selected archive category.
          The <span className="font-display">Archive ID</span> is the real database primary key and is used when attaching a document to a certificate request.
        </p>
      </div>
    </div>
  )
}
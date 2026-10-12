'use client'

import { useEffect, useState } from 'react'
import { inputCls } from '../data/ui'

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

  const [form, setForm] = useState({
  person_name: '',
  sacrament_type: 'baptismal',
  parish: '',
  priest: '',
  date_of_record: '',
  book_number: '',
  page_number: '',
  document_type: 'Scanned Certificate',
})

  const [file, setFile] = useState<File | null>(null)
  const [runOcr, setRunOcr] = useState(true)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [ocrSuggestions, setOcrSuggestions] = useState<Record<string, string>>({})

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

    const formData = new FormData()

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value)
    })

    formData.append('file', file)
    formData.append('runOcr', runOcr ? 'true' : 'false')

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

      alert('Record archived successfully')

      setForm({
  person_name: '',
  sacrament_type: activeTab,
  parish: '',
  priest: '',
  date_of_record: '',
  book_number: '',
  page_number: '',
  document_type: 'Scanned Certificate',
})

      setFile(null)
      setOcrText('')
      setOcrSuggestions({})
      setShowForm(false)
      await loadDocuments()
    } catch (err) {
      console.warn('Archive upload error:', err)
      alert('Upload failed. The parish backend service is unavailable.')
    }

  }

const previewOcr = async () => {
  if (!file) {
    alert('Choose a scanned PDF or image first.')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    setOcrLoading(true)
    const res = await fetch('/api/backend/api/archive/ocr-preview', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || 'OCR preview failed.')
      return
    }
    setOcrText(data.text || '')
    setOcrSuggestions(data.suggestions || {})
  } catch (error) {
    console.warn('OCR preview error:', error)
    alert('OCR preview is unavailable right now.')
  } finally {
    setOcrLoading(false)
  }
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
            setForm(prev => ({
              ...prev,
              sacrament_type: activeTab,
            }))
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
                Book Number
              </label>
              <input
                name="book_number"
                value={form.book_number}
                onChange={handleChange}
                placeholder="Book / Volume"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Page Number
              </label>
              <input
                name="page_number"
                value={form.page_number}
                onChange={handleChange}
                placeholder="Page"
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

            <div className="md:col-span-3">
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Upload Scanned File *
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files?.[0] || null)}
                required
                className={inputCls}
              />
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 font-body text-[12px] text-slate-600">
                  <input type="checkbox" checked={runOcr} onChange={e => setRunOcr(e.target.checked)} />
                  Extract OCR text when saving
                </label>
                <button
                  type="button"
                  onClick={() => void previewOcr()}
                  disabled={!file || ocrLoading}
                  className="font-display text-[10px] tracking-wider border border-blue-200 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {ocrLoading ? 'Reading scan...' : 'Preview OCR'}
                </button>
              </div>
              {(ocrText || Object.keys(ocrSuggestions).length > 0) && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="font-display text-[10px] tracking-wider text-blue-800 mb-1">OCR PREVIEW — VERIFY BEFORE USING</p>
                  {Object.keys(ocrSuggestions).length > 0 && (
                    <div className="mb-2">
                      <p className="font-body text-[11px] text-blue-700">
                        Suggestions: {Object.entries(ocrSuggestions).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setForm(prev => ({
                            ...prev,
                            person_name: ocrSuggestions.possibleName || prev.person_name,
                            date_of_record: /^\d{4}-\d{2}-\d{2}$/.test(ocrSuggestions.dateHint || '')
                              ? ocrSuggestions.dateHint
                              : prev.date_of_record,
                          }))
                        }
                        className="mt-2 font-display text-[9px] tracking-wider bg-blue-600 text-white px-2.5 py-1.5 rounded-lg"
                      >
                        Use Safe Suggestions
                      </button>
                    </div>
                  )}
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
              onClick={() => setShowForm(false)}
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
              setActiveTab(type.value)
              setForm(prev => ({
                ...prev,
                sacrament_type: type.value,
              }))
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
          placeholder="Search by name, book no., certificate no., or filename..."
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
                    {record.filename}
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/backend/files/${record.filepath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-gold/20 text-gold bg-gold/5"
                      >
                        <i className="ti ti-eye text-[14px]" />
                      </a>

                      <button
                        onClick={() => window.open(`/api/backend/files/${record.filepath}`, '_blank')}
                        className="p-1.5 rounded-lg border border-gold/20 text-[#6b8caa]"
                      >
                        <i className="ti ti-printer text-[14px]" />
                      </button>

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
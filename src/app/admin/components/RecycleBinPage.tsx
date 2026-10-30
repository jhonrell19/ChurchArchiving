'use client'

import { useEffect, useState } from 'react'

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

type RecycleBinPageProps = {
  scope: 'main' | 'burial'
}

const toDisplayType = (type: string) => {
  if (type === 'baptismal') return 'Baptismal'
  if (type === 'confirmation') return 'Confirmation'
  if (type === 'marriage') return 'Marriage'
  if (type === 'ownership') return 'Certificate of Ownership'
  if (type === 'burial') return 'Historical Burial Document'
  if (type === 'land_agreement') return 'Land Agreement'
  return type
}

export default function RecycleBinPage({ scope }: RecycleBinPageProps) {
  const [documents, setDocuments] = useState<ArchiveDocument[]>([])
  const [loading, setLoading] = useState(true)

  const loadDeletedDocuments = async () => {
    try {
      setLoading(true)

      const res = await fetch(`/api/backend/api/archive/deleted-documents?scope=${scope}`)

      if (!res.ok) {
        throw new Error('Failed to load recycle bin')
      }

      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (err) {
      console.warn('Recycle bin load error:', err)
      alert('Cannot load recycle bin. The parish backend service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadDeletedDocuments())
  }, [])

  const restoreDocument = async (id: number) => {
    const confirmRestore = confirm('Restore this document back to the archive?')

    if (!confirmRestore) {
      return
    }

    try {
      const res = await fetch(`/api/backend/api/archive/documents/${id}/restore`, {
        method: 'PATCH',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to restore document.')
        return
      }

      alert('Document restored successfully.')
      await loadDeletedDocuments()
    } catch (err) {
      console.warn('Restore document error:', err)
      alert('Failed to restore document. The parish backend service is unavailable.')
    }
  }

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Recycle Bin
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Restore deleted archive records that were moved out of the active archive list.
      </p>

      <div className="bg-white border border-gold/20 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold/10 bg-gold/5">
              {['Archive ID', 'Certificate No.', 'Type', 'Name', 'Date', 'File', 'Actions'].map(h => (
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
                <td colSpan={7} className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
                  Loading deleted records...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
                  Recycle Bin is empty.
                </td>
              </tr>
            ) : (
              documents.map(doc => (
                <tr key={doc.id} className="border-b border-gold/10 last:border-0">
                  <td className="px-5 py-3 font-body text-navy-mid text-[12px]">
                    #{doc.id}
                  </td>

                  <td className="px-5 py-3 font-display text-gold text-[11px] tracking-wider">
                    {doc.certificateNumber || 'N/A'}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px]">
                    {toDisplayType(doc.sacramentType)}
                  </td>

                  <td className="px-5 py-3 font-body text-navy-mid text-[13px]">
                    {doc.personName}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px]">
                    {doc.dateOfRecord || 'No date'}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px]">
                    {doc.filename}
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/backend/files/${doc.filepath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-gold/20 text-gold bg-gold/5"
                        title="View file"
                      >
                        <i className="ti ti-eye text-[14px]" />
                      </a>

                      <button
                        onClick={() => restoreDocument(doc.id)}
                        className="p-1.5 rounded-lg border border-green-200 text-green-600 bg-green-50"
                        title="Restore document"
                      >
                        <i className="ti ti-restore text-[14px]" />
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
          Deleted records are not permanently removed. They are marked inactive and can be restored from this Recycle Bin.
        </p>
      </div>
    </div>
  )
}
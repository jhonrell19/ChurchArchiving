const API_URL = '/api/backend'

export async function getArchiveStats() {
  const res = await fetch(`${API_URL}/api/archive/stats`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch archive stats')
  }

  return res.json()
}

export async function getArchiveDocuments() {
  const res = await fetch(`${API_URL}/api/archive/documents`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch archive documents')
  }

  return res.json()
}

export async function getArchiveDocumentsByType(type: string) {
  const res = await fetch(`${API_URL}/api/archive/documents/${type}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch archive documents by type')
  }

  return res.json()
}
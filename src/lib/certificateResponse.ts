// Both certificate screens read JSON through the same authenticated proxy.
export async function certificateResponse(response: Response) {
  const data = await response.json().catch(() => null)
  if (response.status === 401) throw new Error('Your session has expired. Sign in again.')
  if (!response.ok || !data || typeof data !== 'object') {
    const message = data?.error || data?.message
    if (typeof message === 'string' && message.trim()) throw new Error(message)
    throw new Error(`The certificate service could not load the data (HTTP ${response.status}). Please try again.`)
  }
  return data
}

/** Use the same Session pooler destination as the Flask archive. */
export function authDatabaseUrl() {
  const value = process.env.ARCHIVE_POSTGRES_URL
  if (!value) throw new Error('Set ARCHIVE_POSTGRES_URL to the PostgreSQL Session pooler URL.')
  const url = new URL(value.replace(/^postgresql\+psycopg:/, 'postgresql:'))
  if (url.protocol !== 'postgresql:' || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('ARCHIVE_POSTGRES_URL must identify a PostgreSQL database.')
  }
  url.searchParams.set('schema', 'parish_auth')
  url.searchParams.set('sslmode', 'verify-full')
  return url.toString()
}

import { redirect } from 'next/navigation'

// The old cemetery/office panel has been retired. Preserve the route only
// for legacy users' old bookmarks during the reviewed role migration.
export default function LegacyBurialAdminRedirect() {
  redirect('/staff')
}

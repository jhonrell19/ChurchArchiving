import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser, getRoleHome } from '@/lib/auth'

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Temporary compatibility for the legacy account between web deployment and
  // the reviewed post-deploy role-conversion migration. No cemetery UI is served.
  if (user.role !== 'STAFF' && user.role !== 'BURIAL_ADMIN') {
    redirect(getRoleHome(user.role))
  }
  return children
}

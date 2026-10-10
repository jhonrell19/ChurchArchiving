import type { ReactNode } from 'react'
import { requireRole } from '@/lib/auth'

export default async function BurialAdminLayout({ children }: { children: ReactNode }) {
  await requireRole('BURIAL_ADMIN')
  return children
}

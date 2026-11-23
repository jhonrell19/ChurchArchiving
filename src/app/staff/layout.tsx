import type { ReactNode } from 'react'
import { requireRole } from '@/lib/auth'

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireRole('STAFF')
  return children
}

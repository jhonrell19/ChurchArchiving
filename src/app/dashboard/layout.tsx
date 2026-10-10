import type { ReactNode } from 'react'
import { requireRole } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireRole('USER')
  return children
}

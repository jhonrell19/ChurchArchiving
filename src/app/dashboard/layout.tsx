import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import {
  isUserProfileComplete,
  requireRole,
} from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireRole('USER')

  if (!isUserProfileComplete(user)) {
    redirect('/complete-profile')
  }

  return children
}

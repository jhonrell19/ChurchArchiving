import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import {
  isUserProfileComplete,
  requireRole,
} from '@/lib/auth'

export default async function CompleteProfileLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireRole('USER')

  if (isUserProfileComplete(user)) {
    redirect('/dashboard')
  }

  return children
}

import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import StaffAccounts from './StaffAccounts'

export default async function StaffManagementPage() {
  if (!isSupervisor(await getCurrentUser())) notFound()
  return <StaffAccounts />
}

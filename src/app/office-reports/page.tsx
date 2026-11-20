import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {isSupervisor} from '@/lib/portalConfig'
import ReportView from './ReportView'

export default async function Reports() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'USER') redirect('/dashboard')
  return <ReportView burial={user.role === 'BURIAL_ADMIN'} supervisor={isSupervisor(user) && process.env.PARISH_EXTENDED_REPORTS==='enabled'} />
}

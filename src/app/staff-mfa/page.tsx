import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser, getRoleHome, isUserProfileComplete } from '@/lib/auth'
import { findValidStaffChallenge, MFA_PENDING_COOKIE } from '@/lib/staffMfa'
import StaffMfaForm from './StaffMfaForm'

export default async function StaffMfaPage() {
  const user = await getCurrentUser()
  if (user) {
    if (user.role === 'USER' && !isUserProfileComplete(user)) {
      redirect('/complete-profile')
    }
    redirect(getRoleHome(user.role))
  }

  // The first factor is required before an MFA form can be displayed.
  const pending = (await cookies()).get(MFA_PENDING_COOKIE)?.value
  if (!(await findValidStaffChallenge(pending))) {
    redirect('/login')
  }

  return <StaffMfaForm />
}

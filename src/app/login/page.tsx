import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser, getRoleHome, isUserProfileComplete } from '@/lib/auth'
import { findValidStaffChallenge, MFA_PENDING_COOKIE } from '@/lib/staffMfa'


// Check the real database-backed session before rendering a login form.
// A pending staff MFA challenge is not an authenticated session.
export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) {
    if (user.role === 'USER' && !isUserProfileComplete(user)) {
      redirect('/complete-profile')
    }
    redirect(getRoleHome(user.role))
  }

  const pending = (await cookies()).get(MFA_PENDING_COOKIE)?.value
  if (await findValidStaffChallenge(pending)) {
    redirect('/staff-mfa')
  }

  redirect('/?auth=login#parish-access')
}

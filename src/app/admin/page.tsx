import AdminPanel from './AdminPanel'
import {isSupervisor,portalEnabled} from '@/lib/portalConfig'
import {getCurrentUser} from '@/lib/auth'
export default async function AdminPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const user=await getCurrentUser()
  const supervisor=isSupervisor(user)
  return <AdminPanel accountEmail={user?.email ?? "Unavailable"} initialPage={(await searchParams).page==="settings"?"settings":"dashboard"} manageWebsite={supervisor} managePolicy={portalEnabled() && supervisor} manageStaff={supervisor} />
}
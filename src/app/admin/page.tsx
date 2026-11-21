import AdminPanel from './AdminPanel'
import {isSupervisor,portalEnabled} from '@/lib/portalConfig'
import {getCurrentUser} from '@/lib/auth'
export default async function AdminPage() {
  const supervisor=isSupervisor(await getCurrentUser())
  return <AdminPanel manageWebsite={supervisor} managePolicy={portalEnabled() && supervisor} />
}
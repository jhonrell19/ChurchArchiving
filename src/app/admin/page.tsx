import AdminPanel from './AdminPanel'
import {isSupervisor,portalEnabled} from '@/lib/portalConfig'
import {getCurrentUser} from '@/lib/auth'
export default async function AdminPage() {
  return <AdminPanel managePolicy={portalEnabled() && isSupervisor(await getCurrentUser())} />
}
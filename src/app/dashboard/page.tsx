import UserDashboard from './UserDashboard'
import {publishedContent} from '@/lib/publishedSiteContent'
export const dynamic = 'force-dynamic'
export default async function DashboardPage() {
  const {services}=await publishedContent()
  return <UserDashboard services={services}/>
}
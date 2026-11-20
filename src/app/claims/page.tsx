import { redirect } from 'next/navigation'
import { getCurrentUser, getRoleHome } from '@/lib/auth'
import ClaimDesk from './ClaimDesk'

export default async function Claims() {
  const user=await getCurrentUser()
  if (!user) redirect('/login')
  return <main className="parish-workspace"><a href={getRoleHome(user.role)}>← Dashboard</a>
    <h1>Relationship claims</h1><ClaimDesk applicant={user.role==='USER'}/></main>
}

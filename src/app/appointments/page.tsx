import { redirect } from 'next/navigation'
import { getCurrentUser,getRoleHome } from '@/lib/auth'
import SlotList from './SlotList'
export default async function Appointments(){
  const user=await getCurrentUser()
  if(!user)redirect('/login')
  return <main className="parish-workspace"><a href={getRoleHome(user.role)}>← Dashboard</a><h1>Office appointments</h1>
    <SlotList staff={user.role!=='USER'}/></main>
}

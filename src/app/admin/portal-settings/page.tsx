import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {isSupervisor,portalEnabled} from '@/lib/portalConfig'
import Editor from './Editor'
export default async function PortalSettings(){
  if (!portalEnabled() || !isSupervisor(await getCurrentUser())) notFound()
  return <main className="parish-workspace"><a href="/admin">← Main office</a><h1>Parish policies and purposes</h1><Editor/></main>
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { readEdition,siteEditingEnabled } from '@/lib/publishedSiteContent'
import Editor from './Editor'
export default async function SiteContentPage(){
  const user=await getCurrentUser()
  if (!user) redirect('/login')
  if (!isSupervisor(user)) redirect('/admin')
  const edition=siteEditingEnabled()?await readEdition().catch(()=>null):null
  return <main className="parish-workspace site-editor"><Link href="/admin">← Parish office</Link>
    <h1>Website editor</h1>
    {edition?<Editor initial={edition.content} initialRevision={edition.revision}/>:<p role="status">Website editing is unavailable. Check the site edition migration and the web service’s PARISH_SITE_EDITOR setting.</p>}
  </main>
}

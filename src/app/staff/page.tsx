'use client'

import { useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { useRefreshOnHistoryRestore } from '@/hooks/useRefreshOnHistoryRestore'
import ParishLogo from '../components/ParishLogo'
import ArchivesPage from '../admin/components/ArchivesPage'
import RequestsPage from '../admin/components/RequestsPage'
import DeceasedRecords from './components/DeceasedRecords'
import StaffHome from './components/StaffHome'

type Section = 'dashboard' | 'archives' | 'requests' | 'deceased'
const links: {page:Section;label:string;icon:string}[] = [
  {page:'dashboard',label:'Overview',icon:'ti-layout-dashboard'},
  {page:'archives',label:'Parish records',icon:'ti-archive'},
  {page:'requests',label:'Certificate requests',icon:'ti-file-certificate'},
  {page:'deceased',label:'Deceased records',icon:'ti-file-text'},
]
export default function StaffPage() {
  useRefreshOnHistoryRestore()
  const {toast}=useFeedback()
  const [section,setSection]=useState<Section>('dashboard')
  const [navOpen,setNavOpen]=useState(false)
  const navigate=(target:Section)=>{setSection(target);setNavOpen(false)}
  async function logout(){
    try {
      const response=await fetch('/api/auth/logout',{method:'POST'})
      if (!response.ok) throw Error()
      window.location.replace('/')
    } catch {toast.error('Could not sign out. Please try again.')}
  }
  return <div className="portal-workspace-shell parish-shell min-h-screen lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${navOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex items-center gap-3 border-b border-slate-200 p-5">
        <ParishLogo height={54}/>
        <div><p className="text-lg font-bold leading-tight">Smart Parish System</p><p className="text-slate-600">Church Staff · Documents</p></div>
        <button type="button" className="ml-auto lg:hidden" onClick={()=>setNavOpen(false)} aria-label="Close navigation">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-3 py-2 text-sm font-bold uppercase text-slate-500">Document office</p>
        <nav className="role-nav" aria-label="Church Staff navigation">
          {links.map(link=><button type="button" key={link.page} aria-current={section===link.page?'page':undefined}
            onClick={()=>navigate(link.page)}>
            <i className={`ti ${link.icon}`} aria-hidden="true"/>{link.label}
          </button>)}
          <a href="/office-reports"><i className="ti ti-chart-bar" aria-hidden="true"/>Certificate reports</a>
        </nav>
      </div>
      <div className="border-t border-slate-200 p-3">
        <button onClick={()=>void logout()} className="role-signout w-full"><i className="ti ti-logout" aria-hidden="true"/> Sign out</button>
      </div>
    </aside>
    {navOpen && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={()=>setNavOpen(false)}/>}
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="role-head sticky top-0 z-20 flex min-h-20 items-center gap-3 px-4 sm:px-7">
        <button type="button" className="rounded-lg border p-3 lg:hidden" onClick={()=>setNavOpen(true)} aria-label="Open navigation" aria-expanded={navOpen}>
          <i className="ti ti-menu-2 text-xl" aria-hidden="true"/> Menu
        </button>
        <h1>{links.find(link=>link.page===section)?.label || 'Church Staff'}</h1>
        <span className="ml-auto hidden text-sm text-slate-600 sm:inline">Church Staff workspace</span>
      </header>
      <main className="role-content flex-1">
        {section==='dashboard' && <StaffHome openArchives={()=>navigate('archives')} openRequests={()=>navigate('requests')} openDeceased={()=>navigate('deceased')}/>}
        {section==='archives' && <ArchivesPage/>}
        {section==='requests' && <RequestsPage/>}
        {section==='deceased' && <DeceasedRecords/>}
      </main>
    </div>
  </div>
}

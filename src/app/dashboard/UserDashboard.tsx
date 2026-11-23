'use client'
import { useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { useRefreshOnHistoryRestore } from '@/hooks/useRefreshOnHistoryRestore'
import type { Page } from './types'
import type { Service } from '@/lib/siteContent'
import ParishLogo from '../components/ParishLogo'
import { USER_NAV } from './data/navigation'
import HomePage from './components/HomePage'
import ArchivesPage from './components/ArchivesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import RequestsPage from './components/RequestsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import ProfilePage from './components/ProfilePage'

export default function UserDashboard({services}:{services:Service[]}) {
  useRefreshOnHistoryRestore()
  const {toast}=useFeedback()
  const [page,setPage]=useState<Page>('home')
  const [navOpen,setNavOpen]=useState(false)
  const navigate=(value:Page)=>{setPage(value);setNavOpen(false)}
  async function logout(){
    try {
      const response=await fetch('/api/auth/logout',{method:'POST'})
      if (!response.ok) throw Error()
      window.location.replace('/')
    } catch {toast.error('Sign out failed. Please try again.')}
  }
  return <div className="portal-workspace-shell parish-shell min-h-screen lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${navOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex items-center gap-3 border-b border-slate-200 p-5">
        <ParishLogo height={54}/>
        <div><p className="text-lg font-bold leading-tight">Smart Parish System</p><p className="text-slate-600">Maragondon, Cavite</p></div>
        <button type="button" className="ml-auto lg:hidden" onClick={()=>setNavOpen(false)} aria-label="Close navigation">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-3 py-2 text-sm font-bold uppercase text-slate-500">My parish services</p>
        <nav className="role-nav" aria-label="Parishioner navigation">
          {USER_NAV.map(link=><button type="button" key={link.id} onClick={()=>navigate(link.id)}
            aria-current={page===link.id?'page':undefined}>
            <i className={`ti ${link.icon}`} aria-hidden="true"/>{link.label}
          </button>)}
          {process.env.NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS==='enabled' && <a href="/claims"><i className="ti ti-users" aria-hidden="true"/>Request for a relative</a>}
          {process.env.NEXT_PUBLIC_PARISH_APPOINTMENTS==='enabled' && <a href="/appointments"><i className="ti ti-calendar-plus" aria-hidden="true"/>Office appointments</a>}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-3">
        <button onClick={()=>void logout()} className="role-signout w-full"><i className="ti ti-logout" aria-hidden="true"/> Sign out</button>
      </div>
    </aside>
    {navOpen && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={()=>setNavOpen(false)}/>}
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="role-head sticky top-0 z-20 flex min-h-20 items-center gap-3 px-4 sm:px-7">
        <button type="button" onClick={()=>setNavOpen(true)} aria-label="Open navigation" aria-expanded={navOpen} className="rounded-lg border p-3 lg:hidden">
          <i className="ti ti-menu-2 text-xl" aria-hidden="true"/> Menu
        </button>
        <h1>{USER_NAV.find(item=>item.id===page)?.label || 'Smart Parish'}</h1>
        <span className="ml-auto hidden text-sm text-slate-600 sm:inline">Parishioner portal</span>
      </header>
      <main className="role-content flex-1">
        {page==='home' && <HomePage setPage={navigate}/>}
        {page==='requests' && <RequestsPage/>}
        {page==='announcements' && <AnnouncementsPage services={services}/>}
        {page==='archives' && <ArchivesPage/>}
        {page==='transcriptions' && <TranscriptionsPage/>}
        {page==='profile' && <ProfilePage/>}
      </main>
    </div>
  </div>
}

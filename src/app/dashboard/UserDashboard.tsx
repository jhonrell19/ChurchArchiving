'use client'
import { useState } from 'react'
import type { Page } from './types'
import type { Service } from '@/lib/siteContent'
import WorkspaceShell from '@/components/WorkspaceShell'
import { USER_NAV } from './data/navigation'
import HomePage from './components/HomePage'
import ArchivesPage from './components/ArchivesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import RequestsPage from './components/RequestsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import ProfilePage from './components/ProfilePage'

export default function UserDashboard({services}:{services:Service[]}) {
  const [page,setPage]=useState<Page>('home')
  const navigate=(value:Page)=>{setPage(value)}
  return <WorkspaceShell title={USER_NAV.find(item=>item.id===page)?.label || 'Smart Parish'} role="Parishioner" navigation={<>
        <p className="px-3 py-2 text-sm font-bold uppercase text-slate-500">My parish services</p>
        <nav className="role-nav" aria-label="Parishioner navigation">
          {USER_NAV.map(link=><button type="button" key={link.id} onClick={()=>navigate(link.id)}
            aria-current={page===link.id?'page':undefined}>
            <i className={`ti ${link.icon}`} aria-hidden="true"/>{link.label}
          </button>)}
          {process.env.NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS==='enabled' && <a href="/claims"><i className="ti ti-users" aria-hidden="true"/>Request for a relative</a>}
          {process.env.NEXT_PUBLIC_PARISH_APPOINTMENTS==='enabled' && <a href="/appointments"><i className="ti ti-calendar-plus" aria-hidden="true"/>Office appointments</a>}
        </nav>
    </>}>

        {page==='home' && <HomePage setPage={navigate}/>}
        {page==='requests' && <RequestsPage/>}
        {page==='announcements' && <AnnouncementsPage services={services}/>}
        {page==='archives' && <ArchivesPage/>}
        {page==='transcriptions' && <TranscriptionsPage/>}
        {page==='profile' && <ProfilePage/>}
  </WorkspaceShell>
}

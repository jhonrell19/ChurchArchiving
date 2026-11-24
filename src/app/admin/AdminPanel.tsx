'use client'
import { useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import ParishLogo from '../components/ParishLogo'
import { ADMIN_NAV } from './data/navigation'
import type { AdminPage } from './types.ts'
import SuperAdminOverview from './components/SuperAdminOverview'
import MassesPage from './components/MassesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import SettingsPage from './components/SettingsPage'

export default function AdminPanel({managePolicy=false,manageWebsite=false,manageStaff=false}:{
  managePolicy?:boolean;manageWebsite?:boolean;manageStaff?:boolean
}) {
  const {toast}=useFeedback()
  const [page,setPage]=useState<AdminPage>('dashboard')
  const [transcriptId,setTranscriptId]=useState<number|null>(null)
  const [sidebarOpen,setSidebar]=useState(false)
  const navigate=(next:AdminPage)=>{setPage(next);setSidebar(false)}
  async function logout() {
    try {
      const r=await fetch('/api/auth/logout',{method:'POST'})
      if (!r.ok)throw Error()
      window.location.replace('/')
    } catch {toast.error('Unable to sign out. Please try again.')}
  }
  const label=ADMIN_NAV.find(item=>item.id===page)?.label||'Super Admin'
  const links=[
    ...(manageStaff?[{href:'/admin/staff',text:'Church Staff accounts',icon:'ti-users'}]:[]),
    {href:'/admin/member-approvals',text:'Membership approvals',icon:'ti-user-check'},
    {href:'/office-reports',text:'Reports and exports',icon:'ti-chart-bar'},
    ...(manageWebsite?[{href:'/admin/site-content',text:'Public website editor',icon:'ti-world'}]:[]),
    ...(managePolicy?[{href:'/admin/portal-settings',text:'Privacy policies & purposes',icon:'ti-shield-check'}]:[]),
  ]
  return <div className="portal-workspace-shell parish-shell min-h-screen lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${sidebarOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex items-center gap-3 border-b border-slate-200 p-5">
        <ParishLogo height={54}/>
        <div><p className="text-lg font-bold leading-tight">Smart Parish System</p><p className="text-slate-600">Super Admin</p></div>
        <button className="ml-auto lg:hidden" onClick={()=>setSidebar(false)} aria-label="Close navigation">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-3 py-2 text-sm font-bold uppercase text-slate-500">Operations</p>
        <nav aria-label="Super Admin pages" className="role-nav">
          {ADMIN_NAV.map(item=><button key={item.id} type="button" aria-current={page===item.id?'page':undefined}
            onClick={()=>navigate(item.id)}><i className={`ti ${item.icon}`} aria-hidden="true"/>{item.label}</button>)}
        </nav>
        <p className="px-3 pb-2 pt-5 text-sm font-bold uppercase text-slate-500">Administration</p>
        <nav className="role-nav" aria-label="Super Admin management">
          {links.map(item=><a key={item.href} href={item.href}><i className={`ti ${item.icon}`} aria-hidden="true"/>{item.text}</a>)}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-3">
        <button onClick={()=>void logout()} className="role-signout w-full"><i className="ti ti-logout" aria-hidden="true"/> Sign out</button>
      </div>
    </aside>
    {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={()=>setSidebar(false)}/>}
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="role-head sticky top-0 z-20 flex min-h-20 items-center gap-3 px-4 sm:px-7">
        <button type="button" onClick={()=>setSidebar(true)} aria-label="Open navigation" aria-expanded={sidebarOpen} className="rounded-lg border p-3 lg:hidden">
          <i className="ti ti-menu-2 text-xl" aria-hidden="true"/> Menu
        </button>
        <h1>{label}</h1><span className="ml-auto hidden text-sm text-slate-600 sm:inline">Super Admin workspace</span>
      </header>
      <main className="role-content flex-1">
        {page==='dashboard' && <SuperAdminOverview manageStaff={manageStaff} manageWebsite={manageWebsite}
          onOpenMasses={()=>navigate('masses')} onOpenNotices={()=>navigate('announcements')} onOpenSettings={()=>navigate('settings')}/>}
        {page==='masses' && <MassesPage initialTranscript={transcriptId}/>}
        {page==='transcriptions' && <TranscriptionsPage openMass={id=>{setTranscriptId(id);navigate('masses')}}/>}
        {page==='announcements' && <AnnouncementsPage/>}
        {page==='settings' && <SettingsPage/>}
      </main>
    </div>
  </div>
}

'use client'
import { useState } from 'react'
import WorkspaceShell from '@/components/WorkspaceShell'
import { ADMIN_NAV } from './data/navigation'
import type { AdminPage } from './types.ts'
import SuperAdminOverview from './components/SuperAdminOverview'
import MassesPage from './components/MassesPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import SettingsPage from './components/SettingsPage'

export default function AdminPanel({accountEmail,initialPage="dashboard",managePolicy=false,manageWebsite=false,manageStaff=false}:{
  accountEmail:string;initialPage?:'settings'|'dashboard';managePolicy?:boolean;manageWebsite?:boolean;manageStaff?:boolean
}) {
  const [page,setPage]=useState<AdminPage>(initialPage)
  const navigate=(next:AdminPage)=>{setPage(next)}
  const label=ADMIN_NAV.find(item=>item.id===page)?.label||'Super Admin'
  const links=[
    ...(manageStaff?[{href:'/admin/staff',text:'Church Staff accounts',icon:'ti-users'}]:[]),
    {href:'/admin/member-approvals',text:'Membership approvals',icon:'ti-user-check'},
    {href:'/office-reports',text:'Reports and exports',icon:'ti-chart-bar'},
  ]
  return <WorkspaceShell title={label} role="Super Admin" navigation={<>
        <p className="px-3 py-2 text-sm font-bold uppercase text-slate-500">Operations</p>
        <nav aria-label="Super Admin pages" className="role-nav">
          {ADMIN_NAV.map(item=><button key={item.id} type="button" aria-current={page===item.id?'page':undefined}
            onClick={()=>navigate(item.id)}><i className={`ti ${item.icon}`} aria-hidden="true"/>{item.label}</button>)}
        </nav>
        <p className="px-3 pb-2 pt-5 text-sm font-bold uppercase text-slate-500">Administration</p>
        <nav className="role-nav" aria-label="Super Admin management">
          {links.map(item=><a key={item.href} href={item.href}><i className={`ti ${item.icon}`} aria-hidden="true"/>{item.text}</a>)}
        </nav>
    </>}>

        {page==='dashboard' && <SuperAdminOverview manageStaff={manageStaff} manageWebsite={manageWebsite}
          onOpenMasses={()=>navigate('masses')} onOpenNotices={()=>navigate('announcements')} onOpenSettings={()=>navigate('settings')}/>}
        {page==='masses' && <MassesPage initialTranscript={null}/>}
        {page==='announcements' && <AnnouncementsPage/>}
        {page==='settings' && <SettingsPage manageWebsite={manageWebsite} managePolicy={managePolicy} accountEmail={accountEmail}/>}
  </WorkspaceShell>
}

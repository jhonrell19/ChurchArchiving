'use client'

import { useState } from 'react'
import WorkspaceShell from '@/components/WorkspaceShell'
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
  const [section,setSection]=useState<Section>('dashboard')
  const navigate=(target:Section)=>{setSection(target)}
  return <WorkspaceShell title={links.find(link=>link.page===section)?.label || 'Church Staff'} role="Church Staff" navigation={<>
        <p className="px-3 py-2 text-sm font-bold uppercase text-slate-500">Document office</p>
        <nav className="role-nav" aria-label="Church Staff navigation">
          {links.map(link=><button type="button" key={link.page} aria-current={section===link.page?'page':undefined}
            onClick={()=>navigate(link.page)}>
            <i className={`ti ${link.icon}`} aria-hidden="true"/>{link.label}
          </button>)}
          <a href="/office-reports"><i className="ti ti-chart-bar" aria-hidden="true"/>Certificate reports</a>
        </nav>
    </>}>

        {section==='dashboard' && <StaffHome openArchives={()=>navigate('archives')} openRequests={()=>navigate('requests')} openDeceased={()=>navigate('deceased')}/>}
        {section==='archives' && <ArchivesPage/>}
        {section==='requests' && <RequestsPage/>}
        {section==='deceased' && <DeceasedRecords/>}
  </WorkspaceShell>
}

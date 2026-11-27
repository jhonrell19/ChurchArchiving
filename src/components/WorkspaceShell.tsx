'use client'

import { useRef, type ReactNode } from 'react'
import ParishLogo from '@/app/components/ParishLogo'
import SignOutForm from '@/components/auth/SignOutForm'

export default function WorkspaceShell({ title, role, navigation, children }: {
  title: string; role: string; navigation: ReactNode; children: ReactNode
}) {
  const drawer = useRef<HTMLDialogElement>(null)
  return <div className="portal-workspace-shell parish-shell min-h-screen">
    <header className="role-head workspace-bar">
      <button type="button" aria-haspopup="dialog" aria-controls="workspace-menu"
        onClick={() => drawer.current?.showModal()}><i className="ti ti-menu-2" aria-hidden="true" /> Menu</button>
      <h1>{title}</h1><span>{role}</span>
    </header>
    <dialog ref={drawer} id="workspace-menu" className="workspace-drawer" aria-label={role + ' navigation'}
      onClick={event => { if (event.target === event.currentTarget) drawer.current?.close() }}>
      <div className="drawer-panel">
        <header><ParishLogo height={48}/><strong>{role}</strong>
          <button type="button" aria-label="Close navigation" onClick={() => drawer.current?.close()}>✕</button>
        </header>
        <div className="drawer-links" onClick={event => {
          if ((event.target as HTMLElement).closest('nav button, nav a')) drawer.current?.close()
        }}>{navigation}</div>
        <footer><SignOutForm /></footer>
      </div>
    </dialog>
    <main className="role-content">{children}</main>
  </div>
}

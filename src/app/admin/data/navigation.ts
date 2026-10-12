import type { AdminPage } from '../types.ts'

export const ADMIN_NAV: { id: AdminPage; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { id: 'archives', label: 'Certificate Archives', icon: 'ti-archive' },
  { id: 'masses', label: 'Mass Recordings', icon: 'ti-video' },
  { id: 'transcriptions', label: 'Transcriptions', icon: 'ti-file-text' },
  { id: 'requests', label: 'Requests', icon: 'ti-inbox' },
  { id: 'urgent-requests', label: 'Urgent Requests', icon: 'ti-bolt' },
  { id: 'announcements', label: 'Announcements', icon: 'ti-bell' },
  { id: 'settings', label: 'Settings', icon: 'ti-settings' },
]

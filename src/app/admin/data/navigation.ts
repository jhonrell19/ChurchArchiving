import type { AdminPage } from '../types.ts'

export const ADMIN_NAV: { id: AdminPage; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { id: 'requests', label: 'Certificate requests', icon: 'ti-file-certificate' },
  { id: 'masses', label: 'Homily recordings and transcriptions', icon: 'ti-video' },
  { id: 'announcements', label: 'Announcements', icon: 'ti-bell' },
  { id: 'settings', label: 'Settings', icon: 'ti-settings' },
]

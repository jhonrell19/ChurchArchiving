import type { Page } from '../types'

export const USER_NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'home', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { id: 'archives', label: 'Mass Archives', icon: 'ti-video' },
  { id: 'transcriptions', label: 'Transcribed Mass', icon: 'ti-file-text' },
  { id: 'requests', label: 'My Requests', icon: 'ti-file-plus' },
  { id: 'announcements', label: 'Announcements', icon: 'ti-bell' },
  { id: 'profile', label: 'My Profile', icon: 'ti-user' },
]

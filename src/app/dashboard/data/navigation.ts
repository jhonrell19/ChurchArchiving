import type { Page } from '../types'
export const USER_NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'ti-home' },
  { id: 'requests', label: 'My certificate requests', icon: 'ti-file-certificate' },
  { id: 'announcements', label: 'Mass schedules & notices', icon: 'ti-calendar' },
  { id: 'archives', label: 'Watch recorded Mass', icon: 'ti-video' },
  { id: 'transcriptions', label: 'Read Mass transcripts', icon: 'ti-file-text' },
  { id: 'profile', label: 'My account', icon: 'ti-user' },
]

export type Page        = 'home' | 'archives' | 'transcriptions' | 'announcements' | 'profile' | 'requests'
export type RequestType = 'Baptismal' | 'Marriage' | 'Death Certificate' | 'Confirmation'
export type RequestStatus = 'Pending' | 'Processing' | 'Ready' | 'Rejected'

export type MassRecord = {
  id: number; title: string; date: string; priest: string
  category: string; duration: string; hasTranscript: boolean
}
export type TranscriptRecord = {
  id: number; massTitle: string; date: string; priest: string; words: number; summary: string
}
export type AnnouncementRecord = {
  id: number; title: string; date: string; category: string; body: string
}
export type SubmittedRequest = {
  id: number; type: RequestType; refNo: string; date: string
  status: RequestStatus; fields: Record<string, string>
}
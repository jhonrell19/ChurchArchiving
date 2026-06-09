export type AdminPage    = 'dashboard' | 'archives' | 'transcriptions' | 'requests' | 'masses' | 'announcements' | 'settings'
export type CertType     = 'Baptismal' | 'Confirmation' | 'Marriage' | 'Death Certificate'
export type ReqStatus    = 'Pending' | 'Processing' | 'Ready' | 'Rejected'
export type MassStatus   = 'Pending' | 'In Progress' | 'Transcribed'

export type CertRecord   = { id: number; name: string; date: string; priest: string; refNo: string }
export type MassRecord   = { id: number; title: string; date: string; priest: string; duration: string; status: MassStatus; category: string }
export type RequestRecord = { id: number; refNo: string; type: CertType; requester: string; contact: string; date: string; status: ReqStatus; purpose: string; details: string }
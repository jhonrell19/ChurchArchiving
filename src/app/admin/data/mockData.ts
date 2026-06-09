import type { CertType, CertRecord, MassRecord, RequestRecord, AdminPage } from '../types.ts'

export const CERT_RECORDS: Record<CertType, CertRecord[]> = {
  Baptismal: [
    { id: 1, name: 'Maria Santos',   date: '2024-03-15', priest: 'Fr. Santiago Reyes',  refNo: 'BAP-2024-001' },
    { id: 2, name: 'Jose Dela Cruz', date: '2024-06-22', priest: 'Fr. Manuel Cruz',     refNo: 'BAP-2024-002' },
    { id: 3, name: 'Ana Villanueva', date: '2025-01-10', priest: 'Fr. Jose Villanueva', refNo: 'BAP-2025-001' },
    { id: 4, name: 'Pedro Reyes',    date: '2025-03-05', priest: 'Fr. Santiago Reyes',  refNo: 'BAP-2025-002' },
  ],
  Confirmation: [
    { id: 1, name: 'Miguel Santos',   date: '2024-05-18', priest: 'Bishop Cruz', refNo: 'CON-2024-001' },
    { id: 2, name: 'Luisa Reyes',     date: '2024-05-18', priest: 'Bishop Cruz', refNo: 'CON-2024-002' },
    { id: 3, name: 'Ramon Dela Cruz', date: '2025-04-20', priest: 'Bishop Cruz', refNo: 'CON-2025-001' },
  ],
  Marriage: [
    { id: 1, name: 'Jose & Maria Santos', date: '2024-02-14', priest: 'Fr. Santiago Reyes',  refNo: 'MAR-2024-001' },
    { id: 2, name: 'Pedro & Ana Reyes',   date: '2024-09-28', priest: 'Fr. Manuel Cruz',     refNo: 'MAR-2024-002' },
    { id: 3, name: 'Ramon & Luisa Cruz',  date: '2025-02-08', priest: 'Fr. Jose Villanueva', refNo: 'MAR-2025-001' },
  ],
  'Death Certificate': [
    { id: 1, name: 'Lolo Pedro Santos', date: '2024-04-03', priest: 'Fr. Manuel Cruz',     refNo: 'DTH-2024-001' },
    { id: 2, name: 'Lola Maria Reyes',  date: '2024-11-17', priest: 'Fr. Santiago Reyes',  refNo: 'DTH-2024-002' },
    { id: 3, name: 'Carlos Villanueva', date: '2025-01-29', priest: 'Fr. Jose Villanueva', refNo: 'DTH-2025-001' },
  ],
}

export const MASSES_LIST: MassRecord[] = [
  { id: 1, title: 'Sunday High Mass',        date: '2025-05-25', priest: 'Fr. Santiago Reyes',  duration: '1h 12m', status: 'Transcribed',  category: 'High Mass'      },
  { id: 2, title: 'Good Friday Service',     date: '2025-04-18', priest: 'Fr. Manuel Cruz',     duration: '2h 04m', status: 'Transcribed',  category: 'Special Mass'   },
  { id: 3, title: 'Easter Vigil Mass',       date: '2025-04-19', priest: 'Fr. Santiago Reyes',  duration: '1h 55m', status: 'In Progress',  category: 'Special Mass'   },
  { id: 4, title: 'Morning Mass – Sunday',   date: '2025-05-18', priest: 'Fr. Jose Villanueva', duration: '0h 48m', status: 'Transcribed',  category: 'Morning Mass'   },
  { id: 5, title: 'Bible Study Session',     date: '2025-05-14', priest: 'Fr. Manuel Cruz',     duration: '1h 20m', status: 'In Progress',  category: 'Bible Study'    },
  { id: 6, title: 'Prayer Service – Friday', date: '2025-05-09', priest: 'Fr. Jose Villanueva', duration: '0h 55m', status: 'Pending',      category: 'Prayer Service' },
  { id: 7, title: 'Feast Day Solemn Mass',   date: '2025-05-30', priest: 'Fr. Santiago Reyes',  duration: '1h 40m', status: 'Pending',      category: 'Special Mass'   },
  { id: 8, title: 'Wednesday Bible Study',   date: '2025-05-28', priest: 'Fr. Manuel Cruz',     duration: '1h 05m', status: 'Pending',      category: 'Bible Study'    },
]

export const INCOMING_REQUESTS: RequestRecord[] = [
  { id: 1, refNo: 'IFI-BAP-001', type: 'Baptismal',         requester: 'Juan Dela Cruz',   contact: 'juan@email.com',  date: '2025-05-28', status: 'Pending',    purpose: 'School enrollment',  details: 'Child: Maria Dela Cruz · Baptism date: 2022-03-15 · Father: Juan · Mother: Ana' },
  { id: 2, refNo: 'IFI-MAR-002', type: 'Marriage',           requester: 'Pedro Santos',     contact: 'pedro@email.com', date: '2025-05-27', status: 'Processing', purpose: 'Legal purposes',     details: 'Groom: Pedro Santos · Bride: Luisa Reyes · Marriage date: 2019-02-14' },
  { id: 3, refNo: 'IFI-CON-003', type: 'Confirmation',       requester: 'Ramon Cruz',       contact: 'ramon@email.com', date: '2025-05-26', status: 'Ready',      purpose: 'College requirement',details: 'Confirmand: Ramon Cruz Jr. · Confirmation date: 2023-04-20 · Sponsor: Lolo Ramon' },
  { id: 4, refNo: 'IFI-DTH-004', type: 'Death Certificate',  requester: 'Elena Villanueva', contact: 'elena@email.com', date: '2025-05-25', status: 'Pending',    purpose: 'Estate settlement',  details: 'Deceased: Carlos Villanueva · Date of death: 2025-01-29 · Relation: Daughter' },
  { id: 5, refNo: 'IFI-BAP-005', type: 'Baptismal',         requester: 'Marco Reyes',      contact: 'marco@email.com', date: '2025-05-24', status: 'Rejected',   purpose: 'Immigration',        details: 'Child: Marco Reyes Jr. · Baptism date: 2020-06-10 · Record not found in registry' },
]

export const ADMIN_STATS = [
  { label: 'Total Records',        value: '13', icon: 'ti-archive',       color: 'text-blue-600   bg-blue-50   border-blue-200'   },
  { label: 'Pending Requests',     value: '2',  icon: 'ti-clock',         color: 'text-amber-600  bg-amber-50  border-amber-200'  },
  { label: 'Masses to Transcribe', value: '3',  icon: 'ti-microphone',    color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { label: 'Ready for Pickup',     value: '1',  icon: 'ti-circle-check',  color: 'text-green-600  bg-green-50  border-green-200'  },
]

export const NAV: { id: AdminPage; label: string; icon: string }[] = [
  { id: 'dashboard',      label: 'Dashboard',           icon: 'ti-layout-dashboard' },
  { id: 'archives',       label: 'Certificate Archives',icon: 'ti-archive'          },
  { id: 'masses',         label: 'Mass Recordings',     icon: 'ti-video'            },
  { id: 'transcriptions', label: 'Transcriptions',      icon: 'ti-file-text'        },
  { id: 'requests',       label: 'Incoming Requests',   icon: 'ti-inbox'            },
  { id: 'announcements',  label: 'Announcements',       icon: 'ti-bell'             },
  { id: 'settings',       label: 'Settings',            icon: 'ti-settings'         },
]

export const CERT_ICONS: Record<CertType, string> = {
  Baptismal:          'ti-droplet',
  Confirmation:       'ti-shield-check',
  Marriage:           'ti-rings',
  'Death Certificate':'ti-candle',
}

export const STATUS_STYLE: Record<string, string> = {
  Pending:     'bg-amber-50  text-amber-700  border-amber-200',
  Processing:  'bg-blue-50   text-blue-700   border-blue-200',
  Ready:       'bg-green-50  text-green-700  border-green-200',
  Rejected:    'bg-red-50    text-red-700    border-red-200',
  'In Progress':'bg-blue-50  text-blue-700   border-blue-200',
  Transcribed: 'bg-green-50  text-green-700  border-green-200',
}

export const inputCls  = 'w-full px-3 py-2.5 border border-gold/20 rounded-lg font-body text-[13px] text-navy-mid bg-white focus:outline-none focus:border-gold/50'
export const selectCls = 'border border-gold/20 rounded-lg px-3 py-2.5 font-body text-[13px] text-navy-mid bg-white focus:outline-none'
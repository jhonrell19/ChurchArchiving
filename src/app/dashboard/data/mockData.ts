import type { MassRecord, TranscriptRecord, AnnouncementRecord, Page, RequestType } from '../types'

export const MASSES: MassRecord[] = [
  { id: 1, title: 'Sunday High Mass',        date: '2025-05-25', priest: 'Fr. Santiago Reyes',  category: 'High Mass',      duration: '1h 12m', hasTranscript: true  },
  { id: 2, title: 'Good Friday Service',     date: '2025-04-18', priest: 'Fr. Manuel Cruz',     category: 'Special Mass',   duration: '2h 04m', hasTranscript: true  },
  { id: 3, title: 'Easter Vigil Mass',       date: '2025-04-19', priest: 'Fr. Santiago Reyes',  category: 'Special Mass',   duration: '1h 55m', hasTranscript: false },
  { id: 4, title: 'Morning Mass – Sunday',   date: '2025-05-18', priest: 'Fr. Jose Villanueva', category: 'Morning Mass',   duration: '0h 48m', hasTranscript: true  },
  { id: 5, title: 'Bible Study Session',     date: '2025-05-14', priest: 'Fr. Manuel Cruz',     category: 'Bible Study',    duration: '1h 20m', hasTranscript: true  },
  { id: 6, title: 'Prayer Service – Friday', date: '2025-05-09', priest: 'Fr. Jose Villanueva', category: 'Prayer Service', duration: '0h 55m', hasTranscript: false },
]

export const TRANSCRIPTIONS: TranscriptRecord[] = [
  { id: 1, massTitle: 'Sunday High Mass',      date: '2025-05-25', priest: 'Fr. Santiago Reyes',  words: 4821, summary: "A reflection on the parable of the lost sheep, emphasizing God's boundless mercy and the joy of reconciliation." },
  { id: 2, massTitle: 'Good Friday Service',   date: '2025-04-18', priest: 'Fr. Manuel Cruz',     words: 7230, summary: "A solemn meditation on Christ's passion, calling the faithful to carry their own crosses with humility and grace." },
  { id: 3, massTitle: 'Morning Mass – Sunday', date: '2025-05-18', priest: 'Fr. Jose Villanueva', words: 3140, summary: 'A message on the importance of communal prayer and the role of families as the first school of faith.' },
  { id: 4, massTitle: 'Bible Study Session',   date: '2025-05-14', priest: 'Fr. Manuel Cruz',     words: 5660, summary: 'An in-depth study of the Beatitudes and how they serve as a guide for living a Christ-centered life in modern times.' },
]

export const ANNOUNCEMENTS: AnnouncementRecord[] = [
  { id: 1, title: 'Parish Fiesta 2025 – Save the Date',  date: '2025-05-20', category: 'Event',     body: 'The annual parish fiesta will be held on June 15, 2025. All parishioners are invited to join the celebration of our patron saint.' },
  { id: 2, title: 'New Mass Schedule Starting June',     date: '2025-05-18', category: 'Schedule',  body: 'Beginning June 1st, the Sunday morning mass will move from 8:00 AM to 7:30 AM. The High Mass remains at 10:00 AM.' },
  { id: 3, title: 'Youth Ministry Retreat Registration', date: '2025-05-15', category: 'Ministry',  body: 'Registration for the annual youth retreat is now open. Slots are limited. Contact the parish office or the Youth Ministry coordinator.' },
  { id: 4, title: 'Baptism Schedule – June & July',      date: '2025-05-12', category: 'Sacrament', body: 'Baptism dates for June and July are now available. Families are required to attend a pre-baptism seminar prior to scheduling.' },
]

export const PRIESTS     = ['All Priests', 'Fr. Santiago Reyes', 'Fr. Manuel Cruz', 'Fr. Jose Villanueva']
export const CATEGORIES  = ['All Categories', 'High Mass', 'Morning Mass', 'Special Mass', 'Bible Study', 'Prayer Service']

export const STATS = [
  { label: 'Total Archived Masses', value: '148', icon: 'ti-video'          },
  { label: 'AI Transcriptions',     value: '112', icon: 'ti-file-text'      },
  { label: 'Sermon Summaries',      value: '98',  icon: 'ti-sparkles'       },
  { label: "This Month's Uploads",  value: '6',   icon: 'ti-calendar-month' },
]

export const BADGE_COLOR: Record<string, string> = {
  Event:    'bg-blue-50   text-blue-700   border-blue-200',
  Schedule: 'bg-amber-50  text-amber-700  border-amber-200',
  Ministry: 'bg-green-50  text-green-700  border-green-200',
  Sacrament:'bg-purple-50 text-purple-700 border-purple-200',
}

export const STATUS_STYLE: Record<string, string> = {
  Pending:    'bg-amber-50  text-amber-700  border-amber-200',
  Processing: 'bg-blue-50   text-blue-700   border-blue-200',
  Ready:      'bg-green-50  text-green-700  border-green-200',
  Rejected:   'bg-red-50    text-red-700    border-red-200',
}

export const REQUEST_ICONS: Record<RequestType, string> = {
  Baptismal:          'ti-droplet',
  Marriage:           'ti-rings',
  'Death Certificate':'ti-candle',
  Confirmation:       'ti-shield-check',
}

export const REQUEST_FIELDS: Record<RequestType, { label: string; name: string; type: string; placeholder: string; required: boolean }[]> = {
  Baptismal: [
    { label: 'Full Name of Child',    name: 'childName',   type: 'text',    placeholder: 'e.g. Maria Santos',       required: true  },
    { label: 'Date of Baptism',       name: 'baptismDate', type: 'date',    placeholder: '',                        required: true  },
    { label: "Father's Full Name",    name: 'fatherName',  type: 'text',    placeholder: 'e.g. Jose Santos',        required: true  },
    { label: "Mother's Full Name",    name: 'motherName',  type: 'text',    placeholder: 'e.g. Ana Reyes',          required: true  },
    { label: 'Officiating Priest',    name: 'priest',      type: 'text',    placeholder: 'e.g. Fr. Santiago Reyes', required: false },
    { label: 'Purpose of Request',    name: 'purpose',     type: 'text',    placeholder: 'e.g. School enrollment',  required: true  },
    { label: 'Additional Notes',      name: 'notes',       type: 'textarea',placeholder: 'Any additional info…',    required: false },
  ],
  Marriage: [
    { label: "Groom's Full Name",     name: 'groomName',    type: 'text',    placeholder: 'e.g. Jose Santos',       required: true  },
    { label: "Bride's Full Name",     name: 'brideName',    type: 'text',    placeholder: 'e.g. Maria Reyes',       required: true  },
    { label: 'Date of Marriage',      name: 'marriageDate', type: 'date',    placeholder: '',                       required: true  },
    { label: 'Officiating Priest',    name: 'priest',       type: 'text',    placeholder: 'e.g. Fr. Manuel Cruz',   required: false },
    { label: 'Purpose of Request',    name: 'purpose',      type: 'text',    placeholder: 'e.g. Legal purposes',    required: true  },
    { label: 'Additional Notes',      name: 'notes',        type: 'textarea',placeholder: 'Any additional info…',   required: false },
  ],
  'Death Certificate': [
    { label: 'Full Name of Deceased',    name: 'deceasedName', type: 'text',    placeholder: 'e.g. Pedro Santos',     required: true  },
    { label: 'Date of Death',            name: 'deathDate',    type: 'date',    placeholder: '',                      required: true  },
    { label: 'Date of Burial Mass',      name: 'burialDate',   type: 'date',    placeholder: '',                      required: false },
    { label: 'Relationship to Deceased', name: 'relation',     type: 'text',    placeholder: 'e.g. Son, Daughter',    required: true  },
    { label: 'Purpose of Request',       name: 'purpose',      type: 'text',    placeholder: 'e.g. Estate settlement',required: true  },
    { label: 'Additional Notes',         name: 'notes',        type: 'textarea',placeholder: 'Any additional info…',  required: false },
  ],
  Confirmation: [
    { label: 'Full Name of Confirmand',  name: 'confirmandName', type: 'text',    placeholder: 'e.g. Miguel Santos',    required: true  },
    { label: 'Date of Confirmation',     name: 'confirmDate',    type: 'date',    placeholder: '',                      required: true  },
    { label: 'Confirmation Name',        name: 'confirmName',    type: 'text',    placeholder: 'e.g. Saint Michael',    required: false },
    { label: 'Sponsor Name',             name: 'sponsorName',    type: 'text',    placeholder: 'e.g. Lolo Pedro',       required: false },
    { label: 'Officiating Bishop/Priest',name: 'priest',         type: 'text',    placeholder: 'e.g. Bishop Cruz',      required: false },
    { label: 'Purpose of Request',       name: 'purpose',        type: 'text',    placeholder: 'e.g. School requirement',required: true },
    { label: 'Additional Notes',         name: 'notes',          type: 'textarea',placeholder: 'Any additional info…',  required: false },
  ],
}

export const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'home',           label: 'Dashboard',       icon: 'ti-layout-dashboard' },
  { id: 'archives',       label: 'Mass Archives',   icon: 'ti-video'            },
  { id: 'transcriptions', label: 'Transcribed Mass',icon: 'ti-file-text'        },
  { id: 'requests',       label: 'My Requests',     icon: 'ti-file-plus'        },
  { id: 'announcements',  label: 'Announcements',   icon: 'ti-bell'             },
  { id: 'profile',        label: 'My Profile',      icon: 'ti-user'             },
]

export const inputCls = 'w-full px-3 py-2.5 border border-gold/20 rounded-lg font-body text-[13px] text-navy-mid bg-white focus:outline-none focus:border-gold/50'
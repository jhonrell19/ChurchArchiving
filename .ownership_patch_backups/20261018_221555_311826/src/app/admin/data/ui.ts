export const CERT_ICONS: Record<string, string> = {
  Baptismal: 'ti-droplet',
  Confirmation: 'ti-shield-check',
  Marriage: 'ti-rings',
  'Burial Certificate': 'ti-candle',
  'Land Agreement': 'ti-file-contract',
  death: 'ti-candle',
  burial: 'ti-candle',
  land_agreement: 'ti-file-contract',
}

export const STATUS_STYLE: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-blue-50 text-blue-700 border-blue-200',
  Processing: 'bg-blue-50 text-blue-700 border-blue-200',
  Ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Released: 'bg-purple-50 text-purple-700 border-purple-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Transcribed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export const inputCls =
  'w-full px-3 py-2.5 border border-slate-200 rounded-lg font-body text-[13px] text-navy-mid bg-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all'

export const selectCls =
  'border border-slate-200 rounded-lg px-3 py-2.5 font-body text-[13px] text-navy-mid bg-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all'

import RequestTracking, { type TrackingRequest } from './RequestTracking'

type Details = TrackingRequest & {
  requesterName: string; requesterEmail: string; contactNumber: string
  motherFullName: string | null; fatherFullName: string | null
  personName: string; purpose: string; isUrgent: boolean
  recordDateHint: string | null; recordDetails: string | null
}

function DetailGroup({title, rows}: {title: string; rows: [string, string | null | undefined][]}) {
  return <section className="request-detail-group"><h3>{title}</h3>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
  </section>
}

export default function RequestDetails({request: r, documentType}: {request: Details; documentType: string}) {
  return <div className="request-detail-layout">
    <DetailGroup title="Requester information" rows={[
      ['Requester', r.requesterName], ['Email', r.requesterEmail], ['Phone', r.contactNumber],
      ['Mother’s full name (including maiden name)', r.motherFullName], ['Father’s full name', r.fatherFullName],
    ]}/>
    <DetailGroup title="Request information" rows={[
      ['Certificate', documentType], ['Name on record', r.personName], ['Purpose', r.purpose],
      ['Approximate record date', r.recordDateHint], ['Identifying details', r.recordDetails],
      ['Priority', r.isUrgent ? 'Urgent' : 'Regular'],
    ]}/>
    <section className="request-history"><h3>Status and history</h3><RequestTracking request={r}/></section>
  </div>
}

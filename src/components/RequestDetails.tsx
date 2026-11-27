import RequestTracking, { type TrackingRequest } from './RequestTracking'

type Details = TrackingRequest & {
  requesterName: string; requesterEmail: string; contactNumber: string
  motherFullName: string | null; fatherFullName: string | null
  sacramentType: string
  personName: string; purpose: string; isUrgent: boolean
  recordDateHint: string | null; recordDetails: string | null
}

function DetailGroup({title, rows}: {title: string; rows: [string, string | null | undefined][]}) {
  return <section className="request-detail-group"><h3>{title}</h3>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
  </section>
}

const SACRAMENTAL_CATEGORIES = new Set(['baptismal', 'confirmation', 'marriage'])

export default function RequestDetails({request: r, documentType}: {request: Details; documentType: string}) {
  const isSacramental = SACRAMENTAL_CATEGORIES.has(r.sacramentType)
  const subjectLabel = r.sacramentType === 'ownership'
    ? 'Registered lot holder'
    : r.sacramentType === 'land_agreement' ? 'Applicant / name on agreement' : 'Name on church record'

  return <div className="request-detail-layout">
    <DetailGroup title="Requester information" rows={[
      ['Requester', r.requesterName], ['Email', r.requesterEmail], ['Phone', r.contactNumber],
    ]}/>
    <DetailGroup title="Request information" rows={[
      ['Certificate / document', documentType], [subjectLabel, r.personName],
      ...(isSacramental ? [
        ['Mother’s full name (including maiden name)', r.motherFullName],
        ['Father’s full name', r.fatherFullName],
      ] as [string, string | null | undefined][] : []),
      ['Purpose', r.purpose],
      [r.sacramentType === 'ownership' ? 'Agreement date (if known)' : 'Approximate record date / year', r.recordDateHint],
      ['Identifying details', r.recordDetails],
      ['Priority', r.isUrgent ? 'Urgent' : 'Regular'],
    ]}/>
    <section className="request-history"><h3>Status and history</h3><RequestTracking request={r}/></section>
  </div>
}

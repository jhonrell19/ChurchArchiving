import identityConfig from '../../config/certificate_identity.json'
import RequestTracking, { type TrackingRequest } from './RequestTracking'

type Details = TrackingRequest & {
  id:number; identity?:Record<string,string|boolean>; history?:{status:string;at:string}[]
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

export default function RequestDetails({request: r, documentType, office=false}: {request: Details; documentType: string; office?:boolean}) {
  const isSacramental = SACRAMENTAL_CATEGORIES.has(r.sacramentType)
  const subjectLabel = r.sacramentType === 'ownership'
    ? 'Registered lot holder'
    : r.sacramentType === 'land_agreement' ? 'Applicant / name on agreement' : 'Name on church record'

  const specs = identityConfig[r.sacramentType as keyof typeof identityConfig] || []
  return <div className="request-detail-layout">
    <DetailGroup title={office ? "Account information" : "Requester information"} rows={[
      ['Requester', r.requesterName], ['Email', r.requesterEmail], ['Phone', r.contactNumber],
    ]}/>
    <DetailGroup title="Request information" rows={[
      ['Certificate / document', documentType], [subjectLabel, r.personName],
      ...(isSacramental && (r.sacramentType !== 'marriage' || !r.identity) ? [
        ['Mother’s full name (including maiden name)', r.motherFullName],
        ['Father’s full name', r.fatherFullName],
      ] as [string, string | null | undefined][] : []),
      ...(r.identity ? specs.filter(f => r.identity?.[f.key]).map(f => [f.label,String(r.identity?.[f.key])] as [string,string]) : []),
      ...(r.identity ? [['Copy requested', r.identity.unredacted ? 'Unredacted' : 'Redacted'] as [string,string]] : []),
      ['Purpose', r.purpose],
      [r.sacramentType === 'ownership' ? 'Agreement date (if known)' : 'Approximate record date / year', r.recordDateHint],
      ['Identifying details', r.recordDetails],
      ['Priority', r.isUrgent ? 'Urgent' : 'Regular'],
    ]}/>
    {office && Boolean(r.identity?.proofType) && <a href={'/api/backend/api/requests/'+r.id+'/identity-proof'}>Review identification document</a>}
    {!office && <section className="request-history"><h3>Status and history</h3><RequestTracking request={r}/></section>}
  </div>
}

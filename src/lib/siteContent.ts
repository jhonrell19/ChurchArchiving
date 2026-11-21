import { SCHEDULE } from '@/app/components/serviceSchedule'

const SACRAMENTS = [
  { title: 'Baptism',            desc: 'The sacrament of initiation into the Christian faith. Contact the parish office to schedule and learn about preparation requirements.' },
  { title: 'Matrimony',          desc: 'A sacred covenant before God and the community. Couples are encouraged to inquire at least three months in advance.' },
  { title: 'Confirmation',       desc: 'The strengthening of baptismal grace through the Holy Spirit. Classes and preparation schedules are announced annually.' },
  { title: 'Holy Eucharist',     desc: 'The central act of Christian worship. Celebrated every Sunday at our scheduled masses, open to all baptized members.' },
  { title: 'Burial & Last Rites',desc: 'In times of loss, the Church accompanies families with prayer, comfort, and the celebration of the departed\'s life.' },
  { title: 'Special Blessings',  desc: 'House blessings, vehicle blessings, and other special rites may be arranged by contacting the parish priest directly.' },
]

const MINISTRIES = [
  { title: 'Youth Ministry',    desc: 'Empowering the next generation through fellowship, retreats, and service.' },
  { title: "Women's Guild",     desc: 'A community of women dedicated to prayer, charity works, and parish support.' },
  { title: "Men's Brotherhood", desc: 'Building brotherly bonds through faith formation and community outreach.' },
  { title: 'Choir Ministry',    desc: 'Leading the congregation in sacred song and musical worship every Sunday.' },
]


const STORY = [
  '▪ Founded in 1900 as Iglesia Católica Filipina and affiliated to the IFI in 1903.',
  '▪ Estimated family population: 500 (y2002)',
  '▪ Number of chapels / outstations: 5',
  'As a result of a rift between the influential families of Maragondon and the Archbishop of Manila during the Spanish occupation, the establishment of a Filipino-led religious group came to fruition.',
  'To this day, the IFC survives as a testimonial to the religious devotion of the Riego de Dios family and others in Maragondon.',
]

export const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
export const parishPhotos = ['/slides/slide1.jpg','/slides/slide2.jpg','/slides/slide3.png','/slides/slide4.jpg']
export type Service = {day:string; time:string; tag:string}
type Description = {title:string;desc:string}
export type SiteContent = {title:string; introduction:string; photo:string; services:Service[]; sacraments:Description[]; ministries:Description[];story:string[];address:string;hours:string;email:string}
export const defaultContent: SiteContent = {
  title:'Welcome to our parish.',
  introduction:'Find Mass times and parish notices, or sign in to request a certificate.',
  photo:parishPhotos[0], services:SCHEDULE, sacraments:SACRAMENTS, ministries:MINISTRIES, story:STORY,
  address:'Poblacion 2-B, Maragondon, Cavite, Philippines',hours:'Monday – Friday, 8:00 AM – 5:00 PM',email:'',
}
function shortText(value:unknown, max:number):value is string {
  return typeof value==='string' && value.trim().length>0 && value.length<=max
}
export function validContent(value:unknown):value is SiteContent {
  if (!value || typeof value !== 'object') return false
  const v=value as Partial<SiteContent>
  const sectionsValid=[v.sacraments,v.ministries].every(rows=>Array.isArray(rows)&&rows.length<=40&&
    rows.every(row=>row && shortText(row.title,100)&&shortText(row.desc,1500)))
  return sectionsValid && shortText(v.address,250) && shortText(v.hours,250) &&
    typeof v.email==='string' && v.email.length<=254 && (v.email==='' || /^[^\s@?#&]+@[^\s@?#&]+\.[^\s@?#&]+$/.test(v.email)) &&
    Array.isArray(v.story) && v.story.length<=50 && v.story.every(line=>shortText(line,2000)) &&
    shortText(v.title,90) && shortText(v.introduction,320) && parishPhotos.includes(v.photo || '') &&
    Array.isArray(v.services) && v.services.length<=60 && v.services.every(s=>
      s && weekdays.includes(s.day) && shortText(s.tag,90) && typeof s.time==='string' &&
      /^(?:[1-9]|1[0-2]):[0-5][0-9] (?:AM|PM)$/.test(s.time))
}

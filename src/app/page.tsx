import Footer from './components/Footer'
import ParishCalendar from './components/ParishCalendar'
import ParishSlideshow from './components/ParishSlideshow'
import ParishNoticesPreview from './components/ParishNoticesPreview'
import HomepageAuth from './components/HomepageAuth'
import { publishedContent } from '@/lib/publishedSiteContent'
import { parishPhotos } from '@/lib/siteContent'

export const dynamic = 'force-dynamic'
export default async function HomePage() {
  const content = await publishedContent()
  const photos = [content.photo, ...parishPhotos.filter(photo => photo !== content.photo)]
  return <>
    <main className="portal-home" id="main-content">
      <div id="parish-access" className="portal-home-intro">
        <p className="portal-eyebrow">Iglesia Filipina Independiente · Maragondon, Cavite</p>
        <h1>{content.title}</h1>
        <p>{content.introduction}</p>
      </div>
      <div className="portal-home-layout">
        <HomepageAuth />
        <div className="portal-home-information">
          <ParishSlideshow photos={photos} />
          <ParishNoticesPreview />
        </div>
      </div>
      <nav className="portal-home-shortcuts" aria-label="Explore the parish">
        <a href="#parish-calendar"><span>Mass schedules and calendar</span><span aria-hidden="true">→</span></a>
        <a href="/services"><span>Sacraments and parish services</span><span aria-hidden="true">→</span></a>
        <a href="/contact"><span>Contact the parish office</span><span aria-hidden="true">→</span></a>
      </nav>
      <div id="parish-calendar"><ParishCalendar services={content.services}/></div>
    </main>
    <Footer address={content.address}/>
  </>
}

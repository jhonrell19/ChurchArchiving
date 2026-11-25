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

      <div id="parish-calendar"><ParishCalendar services={content.services}/></div>
    </main>
    <Footer address={content.address}/>
  </>
}

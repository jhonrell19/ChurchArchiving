import { prisma } from './prisma'
import { defaultContent, validContent, type SiteContent } from './siteContent'

export const siteEditingEnabled = () => process.env.PARISH_SITE_EDITOR === 'enabled'

export async function readEdition() {
  if (!siteEditingEnabled()) return {revision:0,content:defaultContent}
  const [row] = await prisma.$queryRaw<{revision:number;content:SiteContent}[]>`
    SELECT revision, content FROM parish_private.site_edition ORDER BY revision DESC LIMIT 1`
  if (row && !validContent(row.content)) throw Error('Invalid parish site edition')
  return row || {revision:0,content:defaultContent}
}
export async function publishedContent() {
  try { return (await readEdition()).content }
  catch {
    console.error('Parish website edition could not be read')
    // The public portal remains usable; omit times until the current schedule is available.
    return {...defaultContent,services:[]}
  }
}

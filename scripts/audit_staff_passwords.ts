/** Read-only safety check: detects legacy demonstration staff credentials without printing them. */
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'
async function main() {
  const staff = await prisma.user.findMany({ where: { role: { in: ['ADMIN','BURIAL_ADMIN'] } },
    select: { role: true, password: true, id: true } })
  if (!staff.length) throw new Error('No staff accounts exist')
  let unsafe = 0
  const known = ['Admin12345','Burial12345','Password123!']
  for (const user of staff) {
    let matched = false
    for (const candidate of known) {
      if (await bcrypt.compare(candidate, user.password)) matched = true
    }
    if (matched) { unsafe++; console.error(`CRITICAL: ${user.role} account id ${user.id} uses a legacy known password.`) }
  }
  if (unsafe) throw new Error(`${unsafe} staff account(s) require immediate password rotation before launch.`)
  console.log(`PASS: ${staff.length} staff accounts checked against known demonstration passwords.`)
  console.log('NOTE: This does NOT verify MFA, password uniqueness, breach exposure or account ownership.')
}
main().catch(e => { console.error(e.message); process.exitCode=1 }).finally(()=>prisma.$disconnect())

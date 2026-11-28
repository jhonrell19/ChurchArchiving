const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const ts = require('typescript')
const rows = []
const db = {session:{
  async create({data}) { rows.push(data) },
  async deleteMany({where}) {
    for (let i=rows.length-1;i>=0;i--) {
      const row=rows[i]
      if (where.tokenHash && row.tokenHash!==where.tokenHash) continue
      if (where.userId && row.userId!==where.userId) continue
      if (where.expiresAt && row.expiresAt>where.expiresAt.lte) continue
      rows.splice(i,1)
    }
  },
}}
db.$transaction = operation => operation(db)
const hashSessionToken = token => crypto.createHash('sha256').update(token).digest('hex')
const moduleUnderTest = {exports:{}}
const source = fs.readFileSync('src/lib/auth.ts','utf8')
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
new Function('require','exports','module',js)(name => {
  if (name==='node:crypto') return crypto
  if (name==='@/lib/prisma') return {prisma:db}
  if (name==='@/lib/sessionValidation') return {hashSessionToken,SESSION_COOKIE:'parish_session'}
  if (name.startsWith('next/')) return {}
  throw Error('Unexpected module '+name)
},moduleUnderTest.exports,moduleUnderTest)

async function run() {
  const {createSession,destroySessionToken}=moduleUnderTest.exports
  const first=await createSession(11,true)
  const user=await createSession(12)
  const otherBrowser=await createSession(11,true)
  assert.equal(rows.length,3)
  assert.notEqual(first.token,otherBrowser.token)
  await destroySessionToken(first.token)
  assert.deepEqual(rows.map(row=>row.tokenHash).sort(),[user.token,otherBrowser.token].map(hashSessionToken).sort())
  assert.equal(rows.find(row=>row.tokenHash===hashSessionToken(user.token)).userId,12)
}
run().catch(error=>{console.error(error);process.exitCode=1})

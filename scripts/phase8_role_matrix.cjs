// Generate the proxy's role-by-endpoint matrix from the actual isAllowed function.
// Run: node scripts/phase8_role_matrix.cjs
const fs = require('node:fs')
const ts = require('typescript')

const source = fs.readFileSync('src/app/api/backend/[...path]/route.ts', 'utf8')
const start = source.indexOf('function isAllowed(')
const end = source.indexOf('function forceRoleScope(', start)
if (start < 0 || end <= start) throw new Error('Proxy authorization function moved; re-review permissions.')
const code = [
  "const MAIN_ARCHIVE_TYPES = new Set(['baptismal','confirmation','marriage'])",
  "const BURIAL_ARCHIVE_TYPES = new Set(['burial','land_agreement','ownership'])",
  source.slice(start, end),
  "module.exports = {isAllowed}",
].join('\n')
const transpiled = ts.transpileModule(code, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText
const auth = { exports: {} }
new Function('module', 'exports', transpiled)(auth, auth.exports)
const isAllowed = auth.exports.isAllowed

const endpoints = [
  ['GET','api/requests'], ['POST','api/requests'],
  ['GET','api/requests/42'], ['PATCH','api/requests/42/status'],
  ['PATCH','api/requests/42/select-record'],
  ['POST','api/requests/42/generate-document'],
  ['POST','api/requests/42/release-document'],
  ['POST','api/requests/42/cash-receipt'],
  ['GET','api/requests/42/download'],
  ['POST','api/requests/42/paymongo-checkout'],
  ['GET','api/archive/documents'], ['GET','api/archive/documents/baptismal'],
  ['GET','api/archive/documents/ownership'], ['POST','api/archive/upload'],
  ['POST','api/archive/ocr-preview'], ['GET','api/archive/audit-logs'],
  ['GET','files/uploads/baptismal/example.pdf'],
  ['GET','api/cemetery/slots'], ['GET','api/cemetery/burials'], ['POST','api/cemetery/burials'],
  ['GET','api/reports/certificates'],
  ['GET','api/reports/members'], ['GET','api/reports/schedules'],
  ['GET','api/masses'], ['POST','api/masses'],
  ['PATCH','api/masses/3/transcription'],
  ['GET','api/announcements'], ['POST','api/announcements'],
  ['GET','api/claims'], ['POST','api/claims'],
  ['POST','api/claims/9/review'], ['GET','api/user/dashboard-summary'],
]
if (require.main === module) {
  console.log('| Method | Endpoint | Super Admin | Church Staff | Legacy Burial Admin | Parishioner |')
  console.log('|---|---|:---:|:---:|:---:|:---:|')
  for (const [method, endpoint] of endpoints) {
    const roles = ['ADMIN','STAFF','BURIAL_ADMIN','USER'].map(role =>
      isAllowed(role, method, endpoint) ? '✓' : '—')
    console.log(`| ${method} | \`${endpoint}\` | ${roles.join(' | ')} |`)
  }
  console.log('\nAccess for request IDs, file paths and office-scoped archives ALSO depends on Flask ownership and role checks.')
  console.log('STAFF is the unified document office; legacy BURIAL_ADMIN remains temporarily for safe migration.')
}
module.exports = { isAllowed, endpoints }

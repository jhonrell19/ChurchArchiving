// Offline UI validation regression: no live accounts or databases.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('src/lib/fieldInput.ts','utf8')
const js = ts.transpileModule(source, {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText
const moduleUnderTest = {exports:{}}
new Function('module','exports',js)(moduleUnderTest,moduleUnderTest.exports)
const {
  sanitizePersonName, isValidPersonName, digitsOnly, phoneCharactersOnly,
  isValidPastCalendarDate, philippineToday,
} = moduleUnderTest.exports

assert.equal(sanitizePersonName("Ana María Dela Cruz 123"), "Ana María Dela Cruz ")
assert.equal(sanitizePersonName("Emil O’Reyes-ñ 🧾"), "Emil O’Reyes-ñ ")
assert.equal(isValidPersonName("Ana María Dela Cruz"), true)
assert.equal(isValidPersonName("Emil O’Reyes"), true)
assert.equal(isValidPersonName("Juan123"), false)
assert.equal(isValidPersonName("12345"), false)
assert.equal(digitsOnly("1a2e+3", 6), "123")
assert.equal(digitsOnly("123456789", 6), "123456")
assert.equal(phoneCharactersOnly("+63 (917) 123-4567"), "+639171234567")
assert.equal(phoneCharactersOnly("0917abc1234567"), "09171234567")
assert.equal(isValidPastCalendarDate("2000-02-29"), true)
assert.equal(isValidPastCalendarDate("2023-02-29"), false)
assert.equal(isValidPastCalendarDate("2025-13-01"), false)
assert.equal(isValidPastCalendarDate("2025"), false)
assert.equal(isValidPastCalendarDate("2099-01-01"), false)
assert.match(philippineToday(), /^\d{4}-\d{2}-\d{2}$/)

const form = fs.readFileSync('src/app/dashboard/components/RequestsPage.tsx','utf8')
const config = JSON.parse(fs.readFileSync('config/certificate_identity.json','utf8'))
const server = fs.readFileSync('church_backend/server.py','utf8')
assert.match(form, /type="date"\s+max=\{philippineToday\(\)\}\s+value=\{formData\.recordDateHint\}/)
assert.match(form, /sanitizePersonName\(value\)/)
assert.doesNotMatch(form, /setCode|Email me a code|Email verification code/, 'Certificate requests use the already-verified account')
assert.match(form, /setClaimId\(digitsOnly\(e\.target\.value,\s*10\)\)/)
for (const fields of Object.values(config))
  for (const field of fields)
    assert.notEqual(field.kind, "yearDate", "Approximate dates must be calendar dates")
assert.match(server, /Choose a valid past date from the calendar/)
assert.match(server, /Enter a valid name on record using letters/)
console.log('PASS field-appropriate name, number and date validation')

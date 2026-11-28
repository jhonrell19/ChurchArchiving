// Offline request-form regression checks; no DB, cookies, or production network.
const assert = require('node:assert/strict')
const fs = require('node:fs')

const userPage = fs.readFileSync('src/app/dashboard/components/RequestsPage.tsx', 'utf8')
const details = fs.readFileSync('src/components/RequestDetails.tsx', 'utf8')
const staff = fs.readFileSync('src/app/admin/components/RequestsPage.tsx', 'utf8')
const server = fs.readFileSync('church_backend/server.py', 'utf8')

const account = userPage.slice(
  userPage.indexOf('Requester Information'),
  userPage.indexOf('Document Fee'),
)
assert.match(account, /profile\.fullName/)
assert.match(account, /profile\.email/)
assert.match(account, /profile\.phoneNumber/)
assert.doesNotMatch(account, /motherFullName|fatherFullName|Your mother|Your father/,
  'Requester account summary must never ask for parents')

const record = userPage.slice(
  userPage.indexOf('Full name on the church record'),
  userPage.indexOf('Notes', userPage.indexOf('Full name on the church record')),
)
assert.match(record, /\{needsParentNames && \(/)
assert.match(record, /Mother’s Full Name \(including maiden name\)/)
assert.match(record, /Father’s Full Name/)
assert.match(userPage, /SACRAMENTAL_TYPES = new Set<RequestType>\(\['Baptismal', 'Confirmation', 'Marriage'\]\)/)
assert.match(userPage, /motherFullName: needsParentNames \?/)
assert.match(userPage, /fatherFullName: needsParentNames \?/)
assert.match(userPage, /if \(needsParentNames\) \{/)

const requesterRows = details.slice(
  details.indexOf('title="Requester information"'),
  details.indexOf('title="Request information"'),
)
assert.doesNotMatch(requesterRows, /motherFullName|fatherFullName/)
const requestRows = details.slice(details.indexOf('title="Request information"'))
assert.match(requestRows, /isSacramental/)
assert.match(requestRows, /r\.motherFullName/)
assert.match(requestRows, /r\.fatherFullName/)

assert.match(userPage, /needsAvailableCemeteryLot = activeType === 'Land Agreement'/)
assert.match(userPage, /if \(!needsAvailableCemeteryLot\) return/)
assert.match(userPage, /\{needsAvailableCemeteryLot && \(/)
assert.match(userPage, /cemeterySlotId: needsAvailableCemeteryLot \? selectedSlotId : undefined/)
assert.match(userPage, /recordDetails: \['Certificate of Ownership', 'Land Agreement'\]/)
assert.match(userPage, /'Agreement \/ Lot Reference \(if known\)'/)
assert.doesNotMatch(userPage, /Burial Admin will verify|Contact the Burial Office/)
assert.match(userPage, /Parish confirmation required/)
assert.match(userPage, /type="date"\s+max=\{philippineToday\(\)\}/)
assert.doesNotMatch(userPage, /placeholder="e\.g\. 2018 or 2018-06-15 \(if known\)"/)

assert.match(server, /if sacrament_type in MAIN_ADMIN_TYPES:/)
assert.match(server, /"motherFullName": None, "fatherFullName": None/)
assert.match(server, /purpose_name == "Apply for Cemetery Lot Agreement"/)
assert.match(server, /if sacrament_type == "land_agreement" and purpose_name/)
assert.match(staff, /const canAutoGenerate = \['baptismal', 'confirmation', 'marriage'\]/)
assert.doesNotMatch(staff, /No automatic ownership-certificate template is configured/)
console.log('PASS request-only identity placement, category validation, land copies without lot lookup, no unsupported staff templates')

// Offline regressions: no payment network, accounts, or production database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const code = fs.readFileSync('src/lib/certificatePayment.ts', 'utf8')
const js = ts.transpileModule(code,{ compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText
const moduleUnderTest={exports:{}}
new Function('module','exports',js)(moduleUnderTest,moduleUnderTest.exports)
const {isTestCertificatePayment,isConfirmedCertificatePayment,certificatePaymentLabel}=moduleUnderTest.exports

for (const method of ['PAYMONGO_TEST','PAYMONGO_TEST_PENDING','DEMO','paymongo_test']) {
  assert.equal(isTestCertificatePayment(method),true, method)
  assert.equal(isConfirmedCertificatePayment('Paid',method),false,method)
  assert.match(certificatePaymentLabel('Paid',method),/Test payment.+no real funds/)
}
for (const method of ['PAYMONGO_LIVE','CASH','cash']) {
  assert.equal(isTestCertificatePayment(method),false, method)
  assert.equal(isConfirmedCertificatePayment('Paid',method),true,method)
  assert.equal(certificatePaymentLabel('Paid',method),'Paid')
}
assert.equal(isConfirmedCertificatePayment('Unpaid','PAYMONGO_LIVE'),false)
assert.equal(isConfirmedCertificatePayment('Pending','CASH'),false)
assert.equal(certificatePaymentLabel('Unpaid','PAYMONGO_TEST_PENDING'),'Unpaid')

const staff=fs.readFileSync('src/app/admin/components/RequestsPage.tsx','utf8')
const user=fs.readFileSync('src/app/dashboard/components/RequestsPage.tsx','utf8')
const tracker=fs.readFileSync('src/components/RequestTracking.tsx','utf8')
const backend=fs.readFileSync('church_backend/server.py','utf8')
assert.match(staff,/const canRelease =[\s\S]*?isConfirmedCertificatePayment\(item\.paymentStatus, item\.paymentMethod\)/)
assert.match(staff,/certificatePaymentLabel\(item\.paymentStatus, item\.paymentMethod\)/)
assert.match(staff,/isTestCertificatePayment\(item\.paymentMethod\)/)
assert.match(user,/certificatePaymentLabel\(req\.paymentStatus, req\.paymentMethod\)/)
assert.match(user,/const confirmedPayment = isConfirmedCertificatePayment\(req\.paymentStatus, req\.paymentMethod\)/)
assert.match(user,/This is a test payment, not real money/)
assert.match(tracker,/const paid = isConfirmedCertificatePayment\(request\.paymentStatus, method\)/)
assert.match(tracker,/Only a simulated payment is recorded/)
assert.match(backend,/Test-mode payment cannot authorize a production certificate release/)
assert.match(backend,/method == 'DEMO' or method\.startswith\('PAYMONGO_TEST'\)/)
console.log('PASS: sandbox Paid remains non-releaseable, live/cash Paid statuses remain eligible, test labels stay explicit')

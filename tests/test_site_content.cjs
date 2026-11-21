// Validate the bundled public edition and the same rules used by the publication API.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  })
  const exports = {}
  new Function('require','exports',outputText)(name => {
    if (name === '@/app/components/serviceSchedule') return load('src/app/components/serviceSchedule.ts')
    return require(name)
  },exports)
  return exports
}
const { validContent, defaultContent } = load('src/lib/siteContent.ts')
assert.equal(validContent(defaultContent), true)
assert.equal(validContent({...defaultContent,services:[],ministries:[],story:[]}), true)
for (const invalid of [
  {photo:'https://example.invalid/photo'}, {title:'   '},
  {services:[{day:'Sunday',time:'24:00 PM',tag:'Mass'}]},
  {story:['']}, {email:'office@example.invalid?subject=test'}, {ministries:[{title:'Choir'}]},
]) assert.equal(validContent({...defaultContent,...invalid}), false)
console.log('PASS default edition, empty schedules, contact fields and publication validation.')

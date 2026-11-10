// Offline TOTP regression test using RFC 6238's SHA-1 59-second test vector.
const fs = require('fs')
const ts = require('typescript')
const Module = require('module')
const file = require('path').join(__dirname, '..', 'src', 'lib', 'staffMfa.ts')
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = new Module(file)
mod.filename = file
mod.paths = module.paths
mod.require = id => id === '@/lib/prisma' ? { prisma: {} } : require(id)
mod._compile(compiled, file)
const { base32Encode, totpAt, matchingTotpStep } = mod.exports
const secret = base32Encode(Buffer.from('12345678901234567890'))
if (totpAt(secret, 1) !== '287082') throw new Error('TOTP RFC test failed')
if (matchingTotpStep(secret, '287082', -1, 59000) !== 1) throw new Error('TOTP validation failed')
if (matchingTotpStep(secret, '287082', 1, 59000) !== null) throw new Error('TOTP replay protection failed')
console.log('PASS: TOTP RFC 6238 and replay protection')

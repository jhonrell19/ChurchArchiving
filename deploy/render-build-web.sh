#!/bin/sh
set -eu
node -e 'const fs=require("node:fs"), {X509Certificate}=require("node:crypto"); const cert=new X509Certificate(fs.readFileSync("prod-ca-2021.crt")); if(!cert.ca)throw Error("Expected the public Supabase CA certificate")'
npm ci --include=dev --no-audit --no-fund
npx --no-install prisma generate
npm run build

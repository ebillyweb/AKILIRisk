#!/usr/bin/env node
/**
 * Prisma 7+ requires Node 20.19+, 22.12+, or 24+.
 * Run `nvm use` in this repo (see .nvmrc) before npm install / dev.
 */
const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(process.version)
if (!m) process.exit(1)
const major = Number(m[1])
const minor = Number(m[2])
const patch = Number(m[3])
const ok =
  major >= 24 ||
  (major === 22 && (minor > 12 || (minor === 12 && patch >= 0))) ||
  (major === 20 && (minor > 19 || (minor === 19 && patch >= 0))) ||
  (major > 20 && major < 22) ||
  (major > 22 && major < 24)

if (!ok) {
  console.error(
    `\nThis project needs Node.js 20.19+, 22.12+, or 24+ (you have ${process.version}).\n` +
      'If you use nvm: run `nvm install` then `nvm use` in the repo root (see .nvmrc).\n',
  )
  process.exit(1)
}

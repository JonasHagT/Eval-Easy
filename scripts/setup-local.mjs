#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync } from 'node:fs'

const major = Number(process.versions.node.split('.')[0])
if (Number.isNaN(major) || major < 20) {
  console.error(`Node.js 20 or newer is required (found ${process.version}).`)
  console.error('Install it from https://nodejs.org then run: npm run setup')
  process.exit(1)
}

if (!existsSync('.env.local')) {
  copyFileSync('.env.example', '.env.local')
  console.log('Created .env.local from .env.example')
  console.log('Open .env.local and set:')
  console.log('  ANTHROPIC_API_KEY')
  console.log('  ANTHROPIC_DEPLOYMENT_ID  (Claude Console managed agent)')
} else {
  console.log('.env.local already exists — leaving it unchanged.')
}

const env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : ''
const hasKey = /^ANTHROPIC_API_KEY\s*=\s*(?!sk-ant-\.\.\.)(\S+)/m.test(env)
if (!hasKey) {
  console.log('\n.env.local still needs a real ANTHROPIC_API_KEY from https://console.anthropic.com')
}

console.log('\nNext:')
console.log('  npm install')
console.log('  npm run dev')
console.log('Then open http://localhost:3000 in Chrome')

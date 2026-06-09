import fs from 'fs'
import path from 'path'
import { Run } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'runs.json')

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readRuns(): Run[] {
  ensure()
  if (!fs.existsSync(FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveRun(run: Run): void {
  ensure()
  const runs = readRuns()
  const i = runs.findIndex(r => r.id === run.id)
  if (i >= 0) runs[i] = run
  else runs.push(run)
  fs.writeFileSync(FILE, JSON.stringify(runs, null, 2))
}

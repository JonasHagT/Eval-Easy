import fs from 'fs'
import path from 'path'
import type { EvalSet } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'eval-sets.json')

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readEvalSets(): EvalSet[] {
  ensure()
  if (!fs.existsSync(FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveEvalSet(set: EvalSet): EvalSet {
  ensure()
  const sets = readEvalSets()
  const i = sets.findIndex(s => s.id === set.id)
  const next = { ...set, updatedAt: new Date().toISOString() }
  if (i >= 0) sets[i] = next
  else sets.push(next)
  fs.writeFileSync(FILE, JSON.stringify(sets, null, 2))
  return next
}

export function deleteEvalSet(id: string): void {
  ensure()
  const sets = readEvalSets().filter(s => s.id !== id)
  fs.writeFileSync(FILE, JSON.stringify(sets, null, 2))
}

export function getEvalSet(id: string): EvalSet | undefined {
  return readEvalSets().find(s => s.id === id)
}

import fs from 'fs'
import path from 'path'
import { TestQuestion } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'test-questions.json')

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readQuestions(): TestQuestion[] {
  ensure()
  if (!fs.existsSync(FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveQuestion(q: TestQuestion): void {
  ensure()
  const qs = readQuestions()
  const i = qs.findIndex(x => x.id === q.id)
  if (i >= 0) qs[i] = q
  else qs.push(q)
  fs.writeFileSync(FILE, JSON.stringify(qs, null, 2))
}

export function deleteQuestion(id: string): void {
  ensure()
  const qs = readQuestions().filter(q => q.id !== id)
  fs.writeFileSync(FILE, JSON.stringify(qs, null, 2))
}

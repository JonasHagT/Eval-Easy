import fs from 'fs'
import path from 'path'
import { EvalEntry } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const EVALS_FILE = path.join(DATA_DIR, 'evals.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function readEvals(): EvalEntry[] {
  ensureDataDir()
  if (!fs.existsSync(EVALS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(EVALS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveEval(entry: EvalEntry): void {
  ensureDataDir()
  const evals = readEvals()
  evals.push(entry)
  fs.writeFileSync(EVALS_FILE, JSON.stringify(evals, null, 2))
}

export function updateEval(id: string, patch: Partial<EvalEntry>): EvalEntry | null {
  ensureDataDir()
  const evals = readEvals()
  const i = evals.findIndex(e => e.id === id)
  if (i < 0) return null
  evals[i] = { ...evals[i], ...patch, id: evals[i].id }
  fs.writeFileSync(EVALS_FILE, JSON.stringify(evals, null, 2))
  return evals[i]
}

export function getEvalsByRun(runId: string): EvalEntry[] {
  return readEvals().filter(e => e.runId === runId)
}

export function clearEvals(): void {
  ensureDataDir()
  fs.writeFileSync(EVALS_FILE, JSON.stringify([], null, 2))
}

export function evalsToCSV(evals: EvalEntry[]): string {
  const headers = [
    'id',
    'sessionId',
    'runId',
    'runName',
    'turnIndex',
    'userMessage',
    'agentResponse',
    'rating',
    'thumbs',
    'tags',
    'comment',
    'agentName',
    'model',
    'reviewStatus',
    'reviewedBy',
    'autoGradeScore',
    'autoGradeVerdict',
    'createdAt',
  ]
  const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const rows = evals.map(e =>
    [
      escape(e.id),
      escape(e.sessionId),
      escape(e.runId),
      escape(e.runName),
      escape(e.turnIndex),
      escape(e.userMessage),
      escape(e.agentResponse),
      escape(e.rating),
      escape(e.thumbs),
      escape(e.tags.join(', ')),
      escape(e.comment),
      escape(e.agentName),
      escape(e.model),
      escape(e.reviewStatus),
      escape(e.reviewedBy),
      escape(e.autoGrade?.score),
      escape(e.autoGrade?.verdict),
      escape(e.createdAt),
    ].join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

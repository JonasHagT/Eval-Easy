import type { ColumnMap, EvalSetRow } from './types'

const QUESTION_ALIASES = [
  'question', 'prompt', 'query', 'input', 'user', 'user message', 'usermessage',
  'test', 'test question', 'q', 'task', 'instruction',
]
const EXPECTED_ALIASES = [
  'answer', 'expected', 'expected answer', 'gold', 'gold answer', 'ground truth',
  'ideal', 'reference', 'target', 'correct', 'correct answer', 'label', 'output',
]
const NOTES_ALIASES = [
  'notes', 'note', 'rubric', 'criteria', 'good answer', 'guidance', 'comment',
  'explanation', 'formula', 'hints', 'what a good answer looks like',
]
const CATEGORY_ALIASES = [
  'category', 'tag', 'section', 'type', 'difficulty', 'topic', 'group',
]
const ID_ALIASES = ['id', '#', 'no', 'number', 'n', 'index', 'qid', 'row']

export function guessColumnMap(columns: string[]): ColumnMap {
  const used = new Set<string>()
  const pick = (aliases: string[]) => {
    const scored = columns
      .map(col => ({ col, score: headerScore(col, aliases) }))
      .filter(x => x.score > 0 && !used.has(x.col))
      .sort((a, b) => b.score - a.score)
    if (!scored[0] || scored[0].score < 40) return null
    used.add(scored[0].col)
    return scored[0].col
  }

  const question = pick(QUESTION_ALIASES)
  const expected = pick(EXPECTED_ALIASES)
  const notes = pick(NOTES_ALIASES)
  const category = pick(CATEGORY_ALIASES)
  const id = pick(ID_ALIASES)

  if (question) {
    return { question, expected, notes, category, id }
  }

  const remaining = columns.filter(c => !used.has(c))
  return {
    question: remaining[0] ?? columns[0] ?? 'question',
    expected: remaining[1] ?? expected,
    notes,
    category,
    id,
  }
}

export function applyColumnMap(
  rows: Record<string, string>[],
  map: ColumnMap,
): EvalSetRow[] {
  return rows
    .map((raw, i) => {
      const question = (raw[map.question] ?? '').trim()
      const expected = (map.expected ? raw[map.expected] : '')?.trim() ?? ''
      const notes = (map.notes ? raw[map.notes] : '')?.trim() ?? ''
      const category = (map.category ? raw[map.category] : '')?.trim() || 'General'
      const id = (map.id ? raw[map.id] : '')?.trim() || `row-${i + 1}`
      return { id, question, expected, notes, category, raw }
    })
    .filter(row => row.question.length > 0)
}

function headerScore(name: string, aliases: string[]): number {
  const n = normalizeHeader(name)
  if (!n) return 0
  if (aliases.includes(n)) return 100
  if (aliases.some(a => n === a.replace(/\s+/g, ''))) return 95
  if (aliases.some(a => n.startsWith(a) || a.startsWith(n))) return 80
  if (aliases.some(a => n.includes(a) || a.includes(n))) return 60
  return 0
}

function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[_./]+/g, ' ').replace(/\s+/g, ' ').trim()
}

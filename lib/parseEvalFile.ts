import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import type { ColumnMap, EvalFileKind } from './types'
import { guessColumnMap } from './columnMap'

export type ParsedEvalTable = {
  sourceType: EvalFileKind
  sourceFile: string
  columns: string[]
  rows: Record<string, string>[]
  suggestedMap: ColumnMap
  warnings: string[]
}

const SKIP_SECTION_HEADERS = /^(foundational|advanced|notes|single figures|these require)/i

export function detectKind(filename: string): EvalFileKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  if (ext === 'docx') return 'docx'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'pdf') return 'pdf'
  throw new Error(`Unsupported file type .${ext}. Use csv, xlsx, xls, docx, pptx, or pdf.`)
}

export async function parseEvalFile(file: { name: string; buffer: Buffer }): Promise<ParsedEvalTable> {
  const sourceType = detectKind(file.name)
  const warnings: string[] = []
  let columns: string[] = []
  let rows: Record<string, string>[] = []

  if (sourceType === 'csv' || sourceType === 'xlsx' || sourceType === 'xls') {
    const parsed = parseSpreadsheet(file.buffer, file.name)
    columns = parsed.columns
    rows = parsed.rows
    warnings.push(...parsed.warnings)
  } else if (sourceType === 'docx') {
    const parsed = await parseDocx(file.buffer)
    columns = parsed.columns
    rows = parsed.rows
    warnings.push(...parsed.warnings)
  } else if (sourceType === 'pptx') {
    const parsed = await parsePptx(file.buffer)
    columns = parsed.columns
    rows = parsed.rows
    warnings.push(...parsed.warnings)
  } else if (sourceType === 'pdf') {
    const parsed = await parsePdf(file.buffer)
    columns = parsed.columns
    rows = parsed.rows
    warnings.push(...parsed.warnings)
  }

  if (rows.length === 0) {
    throw new Error('No eval rows found. Use a table with Question / Answer columns, or numbered Q&A.')
  }

  return {
    sourceType,
    sourceFile: file.name,
    columns,
    rows,
    suggestedMap: guessColumnMap(columns),
    warnings,
  }
}

function parseSpreadsheet(buffer: Buffer, filename: string): {
  columns: string[]
  rows: Record<string, string>[]
  warnings: string[]
} {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
  const warnings: string[] = []
  let best: { columns: string[]; rows: Record<string, string>[]; score: number } | null = null

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    })
    const table = matrixToTable(matrix.map(r => (r ?? []).map(c => String(c ?? '').trim())))
    if (table.rows.length === 0) continue
    const map = guessColumnMap(table.columns)
    const score = table.rows.length * 10 + (map.expected ? 50 : 0) + (map.question !== table.columns[0] ? 20 : 0)
    if (!best || score > best.score) best = { ...table, score }
  }

  if (!best) {
    throw new Error(`No rows found in ${filename}`)
  }
  if (workbook.SheetNames.length > 1) {
    warnings.push(`Using the sheet with the strongest Question/Answer table (${best.rows.length} rows).`)
  }
  return { columns: best.columns, rows: best.rows, warnings }
}

function matrixToTable(matrix: string[][]): { columns: string[]; rows: Record<string, string>[] } {
  const nonempty = matrix.filter(row => row.some(cell => cell.trim().length > 0))
  if (nonempty.length === 0) return { columns: [], rows: [] }

  const headerIdx = nonempty.findIndex(row => looksLikeHeader(row))
  const start = headerIdx >= 0 ? headerIdx : 0
  const headerRow = nonempty[start]
  const columns = uniqueColumns(
    headerIdx >= 0
      ? headerRow.map((c, i) => c || `Column ${i + 1}`)
      : headerRow.map((_, i) => `Column ${i + 1}`)
  )
  const dataStart = headerIdx >= 0 ? start + 1 : start
  const rows = nonempty.slice(dataStart).map(row => {
    const obj: Record<string, string> = {}
    columns.forEach((col, i) => {
      obj[col] = (row[i] ?? '').trim()
    })
    return obj
  }).filter(row => Object.values(row).some(v => v.length > 0))

  if (headerIdx < 0 && columns.length >= 2) {
    return promoteFirstDataRowIfNeeded(columns, rows)
  }
  return { columns, rows }
}

function looksLikeHeader(row: string[]): boolean {
  const joined = row.map(c => c.toLowerCase()).join(' ')
  return /\bquestion\b|\bprompt\b|\bquery\b/.test(joined) || /\banswer\b|\bexpected\b|\bgold\b/.test(joined)
}

function uniqueColumns(cols: string[]): string[] {
  const seen = new Map<string, number>()
  return cols.map(col => {
    const base = col.trim() || 'Column'
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base} ${n + 1}`
  })
}

function promoteFirstDataRowIfNeeded(
  columns: string[],
  rows: Record<string, string>[],
): { columns: string[]; rows: Record<string, string>[] } {
  return { columns, rows }
}

async function parseDocx(buffer: Buffer): Promise<{ columns: string[]; rows: Record<string, string>[]; warnings: string[] }> {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('Invalid .docx file')
  const tables = extractWordTables(xml)
  const warnings: string[] = []
  const picked = pickBestTable(tables)
  if (picked) return { ...picked, warnings }
  warnings.push('No Word table found — parsed numbered questions from document text.')
  return { ...rowsFromText(xmlToText(xml)), warnings }
}

async function parsePptx(buffer: Buffer): Promise<{ columns: string[]; rows: Record<string, string>[]; warnings: string[] }> {
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const tables: string[][][] = []
  const textParts: string[] = []
  for (const name of slideFiles) {
    const xml = await zip.file(name)?.async('string')
    if (!xml) continue
    tables.push(...extractPptTables(xml))
    textParts.push(xmlToText(xml, ['a:t']))
  }

  const warnings: string[] = []
  const picked = pickBestTable(tables)
  if (picked) return { ...picked, warnings }
  warnings.push('No slide table found — parsed numbered questions from slide text.')
  return { ...rowsFromText(textParts.join('\n')), warnings }
}

async function parsePdf(buffer: Buffer): Promise<{ columns: string[]; rows: Record<string, string>[]; warnings: string[] }> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  try {
    const tableResult = await parser.getTable().catch(() => null)
    const tables: string[][][] = []
    if (tableResult?.pages) {
      for (const page of tableResult.pages) {
        for (const table of page.tables ?? []) {
          tables.push(table.map((row: string[]) => row.map(cell => String(cell ?? '').trim())))
        }
      }
    }
    const picked = mergeQaTables(tables)
    const textResult = await parser.getText()
    const fromText = rowsFromText(textResult.text || '')
    if (picked && picked.rows.length >= fromText.rows.length && picked.rows.length >= 2) {
      return { ...picked, warnings: [] }
    }
    if (fromText.rows.length >= 2) {
      return {
        ...fromText,
        warnings: picked && picked.rows.length > 0
          ? [`Combined PDF text into ${fromText.rows.length} Q&A rows.`]
          : ['Parsed PDF text. Check column mapping if Question / Answer look swapped.'],
      }
    }
    if (picked && picked.rows.length >= 2) return { ...picked, warnings: [] }
    throw new Error('No eval rows found in PDF')
  } finally {
    await parser.destroy()
  }
}

function mergeQaTables(tables: string[][][]): { columns: string[]; rows: Record<string, string>[] } | null {
  const parsed = tables
    .map(table => matrixToTable(table))
    .filter(t => t.rows.length > 0 && guessColumnMap(t.columns).question)

  if (parsed.length === 0) return pickBestTable(tables)

  const primary = parsed.reduce((a, b) => (b.rows.length > a.rows.length ? b : a))
  const map = guessColumnMap(primary.columns)
  const rows = parsed.flatMap(t => {
    const otherMap = guessColumnMap(t.columns)
    if (!otherMap.question) return []
    return t.rows.map(row => {
      const out: Record<string, string> = {}
      for (const col of primary.columns) out[col] = ''
      out[map.question] = row[otherMap.question] ?? ''
      if (map.expected && otherMap.expected) out[map.expected] = row[otherMap.expected] ?? ''
      if (map.notes && otherMap.notes) out[map.notes] = row[otherMap.notes] ?? ''
      if (map.category && otherMap.category) out[map.category] = row[otherMap.category] ?? ''
      if (map.id && otherMap.id) out[map.id] = row[otherMap.id] ?? ''
      return out
    })
  }).filter(row => (row[map.question] ?? '').trim().length > 0)

  return { columns: primary.columns, rows }
}

function pickBestTable(tables: string[][][]): { columns: string[]; rows: Record<string, string>[] } | null {
  let best: { columns: string[]; rows: Record<string, string>[]; score: number } | null = null
  for (const table of tables) {
    const parsed = matrixToTable(table)
    if (parsed.rows.length === 0) continue
    const map = guessColumnMap(parsed.columns)
    const score = parsed.rows.length * 10 + (map.expected ? 80 : 0) + (map.question ? 40 : 0)
    if (!best || score > best.score) best = { ...parsed, score }
  }
  return best ? { columns: best.columns, rows: best.rows } : null
}

function extractWordTables(xml: string): string[][][] {
  const tables: string[][][] = []
  const tblRe = /<w:tbl[\s\S]*?<\/w:tbl>/g
  const matches = xml.match(tblRe) ?? []
  for (const tbl of matches) {
    const rows: string[][] = []
    const trRe = /<w:tr[\s\S]*?<\/w:tr>/g
    const trs = tbl.match(trRe) ?? []
    for (const tr of trs) {
      const cells: string[] = []
      const tcRe = /<w:tc[\s\S]*?<\/w:tc>/g
      const tcs = tr.match(tcRe) ?? []
      for (const tc of tcs) {
        cells.push(xmlToText(tc, ['w:t']).replace(/\s+/g, ' ').trim())
      }
      if (cells.some(c => c)) rows.push(cells)
    }
    if (rows.length) tables.push(rows)
  }
  return tables
}

function extractPptTables(xml: string): string[][][] {
  const tables: string[][][] = []
  const tblRe = /<a:tbl[\s\S]*?<\/a:tbl>/g
  const matches = xml.match(tblRe) ?? []
  for (const tbl of matches) {
    const rows: string[][] = []
    const trRe = /<a:tr[\s\S]*?<\/a:tr>/g
    const trs = tbl.match(trRe) ?? []
    for (const tr of trs) {
      const cells: string[] = []
      const tcRe = /<a:tc[\s\S]*?<\/a:tc>/g
      const tcs = tr.match(tcRe) ?? []
      for (const tc of tcs) {
        cells.push(xmlToText(tc, ['a:t']).replace(/\s+/g, ' ').trim())
      }
      if (cells.some(c => c)) rows.push(cells)
    }
    if (rows.length) tables.push(rows)
  }
  return tables
}

function xmlToText(xml: string, tags: string[] = ['w:t', 'a:t']): string {
  const parts: string[] = []
  for (const tag of tags) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(xml))) {
      parts.push(decodeXml(m[1]))
    }
  }
  return parts.join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function rowsFromText(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  const numbered = parseNumberedQa(cleaned)
  if (numbered.length >= 2) {
    return {
      columns: ['#', 'Question', 'Answer'],
      rows: numbered.map(r => ({
        '#': r.id,
        Question: r.question,
        Answer: r.answer,
      })),
    }
  }

  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
  return {
    columns: ['Question'],
    rows: lines
      .filter(l => l.endsWith('?') && l.length > 12 && !SKIP_SECTION_HEADERS.test(l))
      .map((question, i) => ({ Question: question, Answer: '', '#': String(i + 1) })),
  }
}

function parseNumberedQa(text: string): { id: string; question: string; answer: string }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const start = lines.findIndex(l => /^#\b/i.test(l) && /question/i.test(l))
  const slice = start >= 0 ? lines.slice(start + 1) : lines
  const items: { id: string; question: string; answer: string }[] = []

  let current: { id: string; question: string; answer: string } | null = null
  const flush = () => {
    if (!current) return
    current.question = current.question.replace(/\s+/g, ' ').trim()
    current.answer = current.answer.replace(/\s+/g, ' ').trim()
    if (current.question) items.push(current)
    current = null
  }

  for (const line of slice) {
    if (SKIP_SECTION_HEADERS.test(line) || /^--\s*\d+\s+of\s+\d+/i.test(line) || /^notes$/i.test(line)) {
      if (/^notes$/i.test(line)) break
      continue
    }
    const numbered = line.match(/^(\d{1,3})[.)\t ]+(.*)$/)
    if (numbered && Number(numbered[1]) <= items.length + 3) {
      flush()
      const rest = numbered[2].trim()
      current = { id: numbered[1], question: rest, answer: '' }
      continue
    }
    if (!current) continue
    if (!current.question.includes('?')) {
      current.question = `${current.question} ${line}`.trim()
    } else {
      current.answer = current.answer ? `${current.answer} ${line}` : line
    }
  }
  flush()

  return items.filter(i => i.question.includes('?') && i.question.length > 8)
}

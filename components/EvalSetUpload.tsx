'use client'

import { useRef, useState } from 'react'
import { applyColumnMap } from '@/lib/columnMap'
import type { ColumnMap, EvalFileKind, EvalSet, EvalSetRow } from '@/lib/types'

type ParseResult = {
  sourceType: EvalFileKind
  sourceFile: string
  columns: string[]
  rows: Record<string, string>[]
  suggestedMap: ColumnMap
  warnings: string[]
  error?: string
}

interface Props {
  onSaved: (set: EvalSet) => void
}

const ROLE_OPTIONS: { key: keyof ColumnMap; label: string; required?: boolean }[] = [
  { key: 'question', label: 'Question', required: true },
  { key: 'expected', label: 'Expected answer' },
  { key: 'notes', label: 'Notes / rubric' },
  { key: 'category', label: 'Category' },
  { key: 'id', label: 'Row ID' },
]

export default function EvalSetUpload({ onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const preview: EvalSetRow[] = parsed && columnMap
    ? applyColumnMap(parsed.rows, columnMap)
    : []

  const handleFiles = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    setParsed(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/eval-sets/parse', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      setParsed(data)
      setColumnMap(data.suggestedMap)
      setName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!parsed || !columnMap) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/eval-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          sourceFile: parsed.sourceFile,
          sourceType: parsed.sourceType,
          columns: parsed.columns,
          rows: parsed.rows,
          columnMap,
        }),
      })
      const saved: EvalSet = await res.json()
      if (!res.ok) throw new Error((saved as unknown as { error?: string }).error || 'Save failed')
      onSaved(saved)
      setParsed(null)
      setColumnMap(null)
      setName('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save eval set')
    } finally {
      setBusy(false)
    }
  }

  const setRole = (role: keyof ColumnMap, value: string) => {
    if (!columnMap) return
    setColumnMap({
      ...columnMap,
      [role]: value === '' ? (role === 'question' ? columnMap.question : null) : value,
    })
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={`border border-dashed rounded-2xl px-6 py-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700 hover:border-indigo-600'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.docx,.pptx,.pdf"
          className="hidden"
          onChange={e => handleFiles(e.target.files?.[0])}
        />
        <p className="text-sm text-gray-200 font-medium">
          {busy ? 'Reading file…' : 'Upload an eval set'}
        </p>
        <p className="text-xs text-gray-500 mt-1.5">
          CSV, Excel (xlsx/xls), Word (docx), PowerPoint (pptx), or PDF. Columns are detected automatically.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-3 py-2">{error}</p>
      )}

      {parsed && columnMap && (
        <div className="bg-gray-900 border border-indigo-700/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Map columns</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {parsed.sourceFile} · {parsed.rows.length} rows · {parsed.sourceType.toUpperCase()}
              </p>
            </div>
            <button
              onClick={() => { setParsed(null); setColumnMap(null) }}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </div>

          {parsed.warnings.map(w => (
            <p key={w} className="text-xs text-amber-400">{w}</p>
          ))}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Eval set name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Description
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional — shown on the dashboard"
                className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm outline-none placeholder-gray-600"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_OPTIONS.map(role => (
              <label key={role.key} className="text-xs text-gray-400">
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                  {role.label}{role.required ? '' : ' (optional)'}
                </span>
                <select
                  value={columnMap[role.key] ?? ''}
                  onChange={e => setRole(role.key, e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 outline-none"
                >
                  {!role.required && <option value="">— none —</option>}
                  {parsed.columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Question</th>
                  <th className="text-left px-3 py-2">Expected</th>
                  <th className="text-left px-3 py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 8).map(row => (
                  <tr key={row.id} className="border-b border-gray-800/60">
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.id}</td>
                    <td className="px-3 py-2 text-gray-200 max-w-sm">{row.question}</td>
                    <td className="px-3 py-2 text-gray-400 max-w-sm">{row.expected || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 8 && (
              <p className="text-[11px] text-gray-600 px-3 py-2">
                Showing 8 of {preview.length} questions
              </p>
            )}
          </div>

          <button
            onClick={save}
            disabled={busy || !name.trim() || preview.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium rounded-xl"
          >
            Save {preview.length} questions
          </button>
        </div>
      )}
    </div>
  )
}

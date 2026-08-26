'use client'

import { useMemo, useState } from 'react'
import type { EvalEntry } from '@/lib/types'

const TAGS = ['Wrong info', 'Off-topic', 'Too long', 'Too short', 'Tone off', 'Missing context', 'Great answer', 'Helpful']

interface Props {
  evals: EvalEntry[]
  onChange: (entry: EvalEntry) => void
}

export default function EvalRunReview({ evals, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(evals[0]?.id ?? null)
  const [filter, setFilter] = useState<'all' | 'fail' | 'unreviewed'>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return evals.filter(e => {
      if (filter === 'fail') {
        return e.thumbs === 'down' || e.autoGrade?.verdict === 'fail'
      }
      if (filter === 'unreviewed') return !e.comment && e.thumbs === null
      return true
    })
  }, [evals, filter])

  const save = async (entry: EvalEntry, patch: Partial<EvalEntry>) => {
    setSavingId(entry.id)
    try {
      const res = await fetch('/api/evals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, ...patch }),
      })
      const updated: EvalEntry = await res.json()
      onChange(updated)
    } finally {
      setSavingId(null)
    }
  }

  if (evals.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-gray-500">
        Run an eval set to review rows here.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['all', 'fail', 'unreviewed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border capitalize ${
              filter === f
                ? 'border-indigo-500 text-white bg-indigo-950/40'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600 self-center">
          {filtered.length} / {evals.length} rows
        </span>
      </div>

      <div className="space-y-3">
        {filtered.map(entry => {
          const open = openId === entry.id
          const verdict = entry.thumbs === 'up' ? 'pass' : entry.thumbs === 'down' ? 'fail' : entry.autoGrade?.verdict
          return (
            <div key={entry.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : entry.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-800/40"
              >
                <span className="text-[10px] text-gray-600 mt-0.5">#{entry.turnIndex}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 line-clamp-2">{entry.userMessage}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                    {entry.autoGrade?.reasoning || entry.comment || 'No review yet'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xs font-medium ${verdict === 'pass' ? 'text-green-400' : verdict === 'fail' ? 'text-red-400' : 'text-gray-500'}`}>
                    {verdict ?? '—'}
                  </span>
                  <p className="text-[11px] text-gray-600">
                    {entry.rating ?? entry.autoGrade?.score ?? '—'}/5
                  </p>
                </div>
              </button>

              {open && (
                <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Expected</p>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-800/60 rounded-xl p-3 min-h-[4rem]">
                        {entry.expectedAnswer || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Agent response</p>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-800/60 rounded-xl p-3 min-h-[4rem] max-h-64 overflow-y-auto">
                        {entry.agentResponse}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => save(entry, { thumbs: 'up' })}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${entry.thumbs === 'up' ? 'border-green-500 text-green-300 bg-green-950/40' : 'border-gray-700 text-gray-400'}`}
                    >
                      👍 Pass
                    </button>
                    <button
                      onClick={() => save(entry, { thumbs: 'down' })}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${entry.thumbs === 'down' ? 'border-red-500 text-red-300 bg-red-950/40' : 'border-gray-700 text-gray-400'}`}
                    >
                      👎 Fail
                    </button>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => save(entry, { rating: n as 1 | 2 | 3 | 4 | 5 })}
                        className={`text-sm ${entry.rating && entry.rating >= n ? 'text-yellow-400' : 'text-gray-700'}`}
                      >
                        ★
                      </button>
                    ))}
                    {savingId === entry.id && <span className="text-[11px] text-gray-500">Saving…</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {TAGS.map(tag => {
                      const selected = entry.tags.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            const tags = selected ? entry.tags.filter(t => t !== tag) : [...entry.tags, tag]
                            save(entry, { tags })
                          }}
                          className={`text-[11px] px-2 py-1 rounded-full border ${
                            selected ? 'border-indigo-500 text-indigo-200 bg-indigo-950/40' : 'border-gray-700 text-gray-500'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Comment</p>
                    <textarea
                      defaultValue={entry.comment}
                      key={entry.id + entry.comment}
                      rows={3}
                      placeholder="What should it have said? Flag figure mismatches, week vs month Q1, blank-market rows…"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      onBlur={e => {
                        if (e.target.value !== entry.comment) save(entry, { comment: e.target.value })
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

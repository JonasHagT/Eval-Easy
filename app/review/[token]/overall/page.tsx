'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Agent, EvalEntry, Invite, Run } from '@/lib/types'

interface ReviewPayload {
  invite: Invite
  run: Run
  agent?: Agent
  evals: EvalEntry[]
  stats: {
    total: number
    reviewed: number
    pending: number
    passCount: number
    passRate: number
    avgRating: number
    overrides: number
    tagBreakdown: Record<string, number>
    aiPass: number
    aiFail: number
  }
}

export default function ReviewOverallPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [data, setData] = useState<ReviewPayload | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<EvalEntry | null>(null)

  useEffect(() => {
    fetch(`/api/review?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load')
        setData(json)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-sm text-gray-500 p-6">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-sm text-gray-500">
        Loading overall…
      </div>
    )
  }

  const tags = Object.entries(data.stats.tagBreakdown).sort((a, b) => b[1] - a[1])
  const passRate = Math.round(data.stats.passRate)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
              Overall results
            </p>
            <h1 className="text-base font-semibold text-white">{data.run.name}</h1>
          </div>
          <a
            href={`/review/${token}`}
            className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-900 hover:border-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Back to queue
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Pass rate" value={`${passRate}%`} tone={passRate >= 70 ? 'good' : passRate >= 40 ? 'mid' : 'bad'} />
          <Stat label="Reviewed" value={`${data.stats.reviewed}/${data.stats.total}`} />
          <Stat label="Avg score" value={data.stats.avgRating > 0 ? data.stats.avgRating.toFixed(1) : '—'} />
          <Stat label="AI overrides" value={String(data.stats.overrides)} />
        </div>

        {data.stats.pending > 0 && (
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl px-4 py-3 text-sm text-amber-200/90">
            {data.stats.pending} item{data.stats.pending !== 1 ? 's' : ''} still waiting for review.{' '}
            <a href={`/review/${token}`} className="underline hover:text-amber-100">
              Continue scoring →
            </a>
          </div>
        )}

        {tags.length > 0 && (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Common issues</h2>
            <div className="space-y-2">
              {tags.map(([tag, count]) => {
                const pct = data.stats.total > 0 ? (count / data.stats.total) * 100 : 0
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-amber-400">{tag}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">All responses</h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {data.evals.map(e => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="w-full text-left px-5 py-4 hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-sm text-gray-300 line-clamp-1 flex-1">{e.userMessage}</p>
                  <VerdictBadge entry={e} />
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{e.agentResponse}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-600">
                  {e.reviewStatus === 'reviewed' ? (
                    <span className="text-green-600">Reviewed{e.reviewedBy ? ` by ${e.reviewedBy}` : ''}</span>
                  ) : e.reviewStatus === 'skipped' ? (
                    <span>Skipped</span>
                  ) : (
                    <span className="text-amber-600">Needs review</span>
                  )}
                  {e.humanOverride && <span className="text-indigo-500">· Overrode AI</span>}
                  {e.tags.length > 0 && <span>· {e.tags.join(', ')}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-white">Email review</h3>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300 text-2xl leading-none">
                ×
              </button>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Prompt</p>
              <p className="text-sm text-gray-400">{selected.userMessage}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Draft</p>
              <pre className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                {selected.agentResponse}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <VerdictBadge entry={selected} />
              {selected.rating != null && (
                <span className="text-yellow-400 text-xs">{'★'.repeat(selected.rating)}</span>
              )}
              {selected.autoGrade && (
                <span className="text-xs text-gray-500">
                  AI: {selected.autoGrade.verdict} ({selected.autoGrade.score}/5) — {selected.autoGrade.reasoning}
                </span>
              )}
            </div>
            {selected.comment && (
              <p className="text-sm text-gray-400 italic">&ldquo;{selected.comment}&rdquo;</p>
            )}
            {selected.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.tags.map(t => (
                  <span key={t} className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'mid' | 'bad'
}) {
  const color =
    tone === 'good' ? 'text-green-400' : tone === 'mid' ? 'text-amber-400' : tone === 'bad' ? 'text-red-400' : 'text-white'
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function VerdictBadge({ entry }: { entry: EvalEntry }) {
  if (entry.thumbs === 'up') {
    return <span className="text-xs bg-green-950/50 text-green-400 border border-green-900 px-2 py-0.5 rounded-full">Pass</span>
  }
  if (entry.thumbs === 'down') {
    return <span className="text-xs bg-red-950/50 text-red-400 border border-red-900 px-2 py-0.5 rounded-full">Fail</span>
  }
  if (entry.autoGrade) {
    return (
      <span
        className={`text-xs border px-2 py-0.5 rounded-full ${
          entry.autoGrade.verdict === 'pass'
            ? 'bg-green-950/30 text-green-500 border-green-900'
            : 'bg-red-950/30 text-red-500 border-red-900'
        }`}
      >
        AI {entry.autoGrade.verdict}
      </span>
    )
  }
  return <span className="text-xs text-gray-600">—</span>
}

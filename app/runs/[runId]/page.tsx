'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import InviteModal from '@/components/InviteModal'
import type { Agent, EvalEntry, Invite, Run } from '@/lib/types'

interface Payload {
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
  }
}

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>()
  const runId = params.runId
  const [data, setData] = useState<Payload | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<EvalEntry | null>(null)

  const load = async () => {
    const [reviewRes, inviteRes] = await Promise.all([
      fetch(`/api/review?runId=${encodeURIComponent(runId)}`),
      fetch(`/api/invites?runId=${encodeURIComponent(runId)}`),
    ])
    const review = await reviewRes.json()
    if (!reviewRes.ok) {
      setError(review.error || 'Run not found')
      return
    }
    setData(review)
    if (inviteRes.ok) setInvites(await inviteRes.json())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  const rerun = async (failedOnly: boolean) => {
    setRerunning(true)
    setError('')
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rerunOf: runId,
          failedOnly,
          agentId: data?.run.agentId,
          name: failedOnly
            ? `Retry failed — ${data?.run.name}`
            : `Re-run — ${data?.run.name}`,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Re-run failed')
      window.location.href = `/runs/${json.run.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-run failed')
      setRerunning(false)
    }
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-sm text-gray-500">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-sm text-gray-500">
        Loading run…
      </div>
    )
  }

  const passRate = Math.round(data.stats.passRate)
  const tags = Object.entries(data.stats.tagBreakdown).sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <a href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm shrink-0">
              ← Dashboard
            </a>
            <span className="text-gray-700">|</span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">{data.run.name}</h1>
              <p className="text-xs text-gray-500 truncate">
                {data.run.agentName}
                {data.run.parentRunId ? ' · re-run' : ''}
                {' · '}
                {data.run.model.replace('claude-', '').replace('-20251001', '')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Invite reviewer
            </button>
            <button
              onClick={() => rerun(false)}
              disabled={rerunning}
              className="text-xs text-gray-300 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {rerunning ? 'Running…' : 'Re-run all'}
            </button>
            <button
              onClick={() => rerun(true)}
              disabled={rerunning}
              className="text-xs text-gray-300 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Retry failed
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Pass rate" value={`${passRate}%`} accent={passRate >= 70 ? 'green' : passRate >= 40 ? 'amber' : 'red'} />
          <Metric label="Reviewed" value={`${data.stats.reviewed}/${data.stats.total}`} />
          <Metric label="Pending review" value={String(data.stats.pending)} accent={data.stats.pending > 0 ? 'amber' : undefined} />
          <Metric label="AI overrides" value={String(data.stats.overrides)} />
        </div>

        {data.run.description && (
          <p className="text-sm text-gray-500">{data.run.description}</p>
        )}

        {/* Invites */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Reviewer invites</h2>
            <button
              onClick={() => setShowInvite(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + New invite
            </button>
          </div>
          {invites.length === 0 ? (
            <p className="text-sm text-gray-600">
              No invites yet. Create a link for a domain specialist to score this run.
            </p>
          ) : (
            <div className="space-y-2">
              {invites.map(inv => {
                const url =
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/review/${inv.token}`
                    : `/review/${inv.token}`
                return (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-gray-800/50 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200">{inv.label}</p>
                      <p className="text-xs text-gray-600 font-mono truncate">{url}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-600">{inv.openCount} opens</span>
                      <a
                        href={`/review/${inv.token}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-900 px-2 py-1 rounded-lg"
                      >
                        Open
                      </a>
                      <a
                        href={`/review/${inv.token}/overall`}
                        className="text-xs text-gray-400 hover:text-white border border-gray-700 px-2 py-1 rounded-lg"
                      >
                        Overall
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(url)}
                        className="text-xs text-gray-400 hover:text-white border border-gray-700 px-2 py-1 rounded-lg"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {tags.length > 0 && (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Common issues</h2>
            <div className="space-y-2">
              {tags.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-amber-400 shrink-0">{tag}</span>
                  <div className="flex-1 bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{
                        width: `${data.stats.total ? (count / data.stats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Responses</h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {data.evals.map(e => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="w-full text-left px-5 py-4 hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex justify-between gap-3 mb-1">
                  <p className="text-sm text-gray-300 line-clamp-1">{e.userMessage}</p>
                  <span className="text-xs shrink-0">
                    {e.thumbs === 'up' ? (
                      <span className="text-green-400">Pass</span>
                    ) : e.thumbs === 'down' ? (
                      <span className="text-red-400">Fail</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{e.agentResponse}</p>
                <p className="text-[11px] text-gray-600 mt-1.5">
                  {e.reviewStatus === 'reviewed'
                    ? `Reviewed${e.reviewedBy ? ` by ${e.reviewedBy}` : ''}`
                    : e.reviewStatus === 'skipped'
                      ? 'Skipped'
                      : 'Needs review'}
                  {e.humanOverride ? ' · Overrode AI' : ''}
                </p>
              </button>
            ))}
          </div>
        </section>
      </main>

      {showInvite && (
        <InviteModal
          runId={data.run.id}
          runName={data.run.name}
          agentId={data.run.agentId}
          onClose={() => {
            setShowInvite(false)
            load()
          }}
        />
      )}

      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <h3 className="text-base font-semibold text-white">Email draft</h3>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300 text-2xl">
                ×
              </button>
            </div>
            <p className="text-sm text-gray-400">{selected.userMessage}</p>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-gray-950/50 border border-gray-800 rounded-xl p-4">
              {selected.agentResponse}
            </pre>
            {selected.autoGrade && (
              <p className="text-xs text-gray-500">
                AI: {selected.autoGrade.verdict} ({selected.autoGrade.score}/5) —{' '}
                {selected.autoGrade.reasoning}
              </p>
            )}
            {selected.comment && (
              <p className="text-sm text-gray-400 italic">&ldquo;{selected.comment}&rdquo;</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'green' | 'amber' | 'red'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'amber'
        ? 'text-amber-400'
        : accent === 'red'
          ? 'text-red-400'
          : 'text-white'
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

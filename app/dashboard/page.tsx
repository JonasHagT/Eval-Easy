'use client'

import { useEffect, useState } from 'react'
import { EvalEntry, Run } from '@/lib/types'
import ProgressChart, { ChartDataPoint } from '@/components/ProgressChart'
import InviteModal from '@/components/InviteModal'

const BLOCKING_TAGS = ['Wrong info', 'Off-topic', 'Placeholders left']

interface RunStats {
  run: Run
  total: number
  passCount: number
  passRate: number
  avgRating: number
  blockingCount: number
  pendingReview: number
  tagBreakdown: Record<string, number>
  mode: string
}

export default function DashboardPage() {
  const [evals, setEvals] = useState<EvalEntry[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteRun, setInviteRun] = useState<Run | null>(null)
  const [rerunningId, setRerunningId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/evals').then(r => r.json()),
      fetch('/api/runs').then(r => r.json()),
    ]).then(([evalData, runData]) => {
      setEvals(evalData)
      setRuns(runData)
      setLoading(false)
    })
  }, [])

  const rerun = async (run: Run, failedOnly = false) => {
    setRerunningId(run.id)
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rerunOf: run.id,
          failedOnly,
          agentId: run.agentId,
          name: failedOnly ? `Retry failed — ${run.name}` : `Re-run — ${run.name}`,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Re-run failed')
      window.location.href = `/runs/${json.run.id}`
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Re-run failed')
      setRerunningId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading dashboard…
      </div>
    )
  }

  const runMap = new Map<string, Run>(runs.map(r => [r.id, r]))
  const evalsByRun = new Map<string, EvalEntry[]>()
  for (const e of evals) {
    const key = e.runId ?? '__manual__'
    if (!evalsByRun.has(key)) evalsByRun.set(key, [])
    evalsByRun.get(key)!.push(e)
  }

  const runStats: RunStats[] = []
  for (const [runId, runEvals] of evalsByRun) {
    if (runId === '__manual__') continue
    const run = runMap.get(runId)
    if (!run) continue
    const withThumbs = runEvals.filter(e => e.thumbs !== null)
    const passCount = withThumbs.filter(e => e.thumbs === 'up').length
    const passRate = withThumbs.length > 0 ? (passCount / withThumbs.length) * 100 : 0
    const ratedEvals = runEvals.filter(e => e.rating !== null)
    const avgRating =
      ratedEvals.length > 0
        ? ratedEvals.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedEvals.length
        : 0
    const blockingCount = runEvals.filter(e =>
      e.tags.some(t => BLOCKING_TAGS.includes(t))
    ).length
    const pendingReview = runEvals.filter(
      e => e.reviewStatus !== 'reviewed' && e.reviewStatus !== 'skipped'
    ).length
    const tagBreakdown: Record<string, number> = {}
    for (const e of runEvals) {
      for (const t of e.tags) tagBreakdown[t] = (tagBreakdown[t] ?? 0) + 1
    }
    runStats.push({
      run,
      total: runEvals.length,
      passCount,
      passRate,
      avgRating,
      blockingCount,
      pendingReview,
      tagBreakdown,
      mode: run.mode,
    })
  }

  runStats.sort((a, b) => new Date(a.run.createdAt).getTime() - new Date(b.run.createdAt).getTime())

  const withThumbs = evals.filter(e => e.thumbs !== null)
  const totalPass = withThumbs.filter(e => e.thumbs === 'up').length
  const overallPassRate = withThumbs.length > 0 ? (totalPass / withThumbs.length) * 100 : 0
  const ratedAll = evals.filter(e => e.rating !== null)
  const overallAvgRating =
    ratedAll.length > 0
      ? ratedAll.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedAll.length
      : 0
  const pendingAll = evals.filter(
    e => e.reviewStatus === 'pending_review' || (!e.reviewStatus && e.autoGrade)
  ).length
  const allTagBreakdown: Record<string, number> = {}
  for (const e of evals) {
    for (const t of e.tags) allTagBreakdown[t] = (allTagBreakdown[t] ?? 0) + 1
  }
  const sortedTags = Object.entries(allTagBreakdown).sort((a, b) => b[1] - a[1])

  const chartData: ChartDataPoint[] = runStats.map(rs => ({
    label: rs.run.name,
    passRate: rs.passRate,
    model: rs.run.model,
    mode: rs.mode,
  }))

  const bestRun = [...runStats].sort((a, b) => b.passRate - a.passRate)[0]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ← Chat
            </a>
            <span className="text-gray-700">|</span>
            <a href="/test-suite" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              Test Bank
            </a>
            <span className="text-gray-700">|</span>
            <span className="text-base font-semibold text-white">Dashboard</span>
          </div>
          <a
            href="/api/evals/export"
            className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 hover:border-indigo-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Export CSV
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {pendingAll > 0 && (
          <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-3 text-sm text-amber-200/90 flex flex-wrap items-center justify-between gap-3">
            <span>
              {pendingAll} response{pendingAll !== 1 ? 's' : ''} waiting for specialist review.
            </span>
            <span className="text-xs text-amber-500/80">
              Open a run → Invite reviewer to share a scoring link.
            </span>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Pass Rate Progress</h2>
              <p className="text-xs text-gray-500 mt-0.5">Pass rate per run, ordered by date</p>
            </div>
            <a
              href="/test-suite"
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 hover:border-indigo-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              ▶ Run tests
            </a>
          </div>
          <ProgressChart data={chartData} />
          <div className="flex gap-4 mt-3 justify-end">
            {[
              { model: 'claude-sonnet-4-6', label: 'Sonnet', color: '#6366f1' },
              { model: 'claude-opus-4-8', label: 'Opus', color: '#a855f7' },
              { model: 'claude-haiku-4-5-20251001', label: 'Haiku', color: '#22d3ee' },
            ].map(m => (
              <div key={m.model} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                <span className="text-xs text-gray-500">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total Evals</p>
            <p className="text-3xl font-bold text-white">{evals.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Overall Pass Rate</p>
            <p
              className={`text-3xl font-bold ${
                overallPassRate >= 70
                  ? 'text-green-400'
                  : overallPassRate >= 40
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {withThumbs.length > 0 ? `${Math.round(overallPassRate)}%` : '—'}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Avg Rating</p>
            <p className="text-3xl font-bold text-yellow-400">
              {ratedAll.length > 0 ? overallAvgRating.toFixed(1) : '—'}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Named Runs</p>
            <p className="text-3xl font-bold text-indigo-400">{runs.length}</p>
          </div>
        </div>

        {runStats.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Run Comparison</h2>
              <span className="text-xs text-gray-600">
                Open a run to invite reviewers or re-run
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3">Run</th>
                    <th className="text-left px-4 py-3">Model</th>
                    <th className="text-center px-4 py-3">Pass Rate</th>
                    <th className="text-center px-4 py-3">Pending</th>
                    <th className="text-center px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...runStats].reverse().map(rs => {
                    const isBest = bestRun?.run.id === rs.run.id
                    return (
                      <tr
                        key={rs.run.id}
                        className={`border-b border-gray-800/50 transition-colors ${
                          isBest ? 'bg-green-950/20' : 'hover:bg-gray-800/30'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isBest && (
                              <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
                                best
                              </span>
                            )}
                            <div>
                              <a
                                href={`/runs/${rs.run.id}`}
                                className="text-white font-medium hover:text-indigo-300"
                              >
                                {rs.run.name}
                              </a>
                              {rs.run.description && (
                                <p className="text-xs text-gray-600">{rs.run.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs text-gray-400">
                            {rs.run.model.replace('claude-', '').replace('-20251001', '')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`font-semibold ${
                              rs.passRate >= 70
                                ? 'text-green-400'
                                : rs.passRate >= 40
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {rs.total > 0 ? `${Math.round(rs.passRate)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {rs.pendingReview > 0 ? (
                            <span className="text-amber-400 font-medium">{rs.pendingReview}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={`/runs/${rs.run.id}`}
                              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-900 px-2 py-1 rounded-lg"
                            >
                              Open
                            </a>
                            <button
                              onClick={() => setInviteRun(rs.run)}
                              className="text-xs text-gray-400 hover:text-white border border-gray-700 px-2 py-1 rounded-lg"
                            >
                              Invite
                            </button>
                            <button
                              onClick={() => rerun(rs.run)}
                              disabled={rerunningId === rs.run.id}
                              className="text-xs text-gray-400 hover:text-white border border-gray-700 px-2 py-1 rounded-lg disabled:opacity-50"
                            >
                              {rerunningId === rs.run.id ? '…' : 'Re-run'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sortedTags.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Failure Analysis</h2>
            <div className="space-y-2">
              {sortedTags.map(([tag, count]) => {
                const pct = evals.length > 0 ? (count / evals.length) * 100 : 0
                const isBlocking = BLOCKING_TAGS.includes(tag)
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 flex items-center gap-1.5">
                      <span
                        className={`text-xs font-medium ${
                          isBlocking ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {tag}
                      </span>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBlocking ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {count} ({Math.round(pct)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">All Evals</h2>
          </div>
          {evals.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-600">
              No evals yet. Start a chat session or run a batch test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3">Question</th>
                    <th className="text-left px-4 py-3">Run</th>
                    <th className="text-center px-4 py-3">Verdict</th>
                    <th className="text-center px-4 py-3">Review</th>
                    <th className="text-left px-4 py-3">Notes</th>
                    <th className="text-right px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[...evals].reverse().map(e => (
                    <tr
                      key={e.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-6 py-3 max-w-xs">
                        <p className="text-xs text-gray-400 line-clamp-2">{e.userMessage}</p>
                      </td>
                      <td className="px-4 py-3">
                        {e.runId ? (
                          <a
                            href={`/runs/${e.runId}`}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            {e.runName ?? 'Run'}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.thumbs === 'up' ? (
                          <span className="text-xs text-green-400">Pass</span>
                        ) : e.thumbs === 'down' ? (
                          <span className="text-xs text-red-400">Fail</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.reviewStatus === 'reviewed' ? (
                          <span className="text-[10px] text-green-600">
                            {e.reviewedBy ?? 'done'}
                          </span>
                        ) : e.reviewStatus === 'skipped' ? (
                          <span className="text-[10px] text-gray-600">skipped</span>
                        ) : e.autoGrade ? (
                          <span className="text-[10px] text-amber-500">pending</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-gray-600 line-clamp-2 italic">
                          {e.comment || e.autoGrade?.reasoning || ''}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-gray-600 whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {inviteRun && (
        <InviteModal
          runId={inviteRun.id}
          runName={inviteRun.name}
          agentId={inviteRun.agentId}
          onClose={() => setInviteRun(null)}
        />
      )}
    </div>
  )
}

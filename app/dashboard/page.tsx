'use client'

import { useEffect, useState } from 'react'
import { EvalEntry, Run } from '@/lib/types'
import ProgressChart, { ChartDataPoint } from '@/components/ProgressChart'

const BLOCKING_TAGS = ['Wrong info', 'Off-topic']

interface RunStats {
  run: Run
  total: number
  passCount: number
  passRate: number
  avgRating: number
  blockingCount: number
  tagBreakdown: Record<string, number>
  mode: string
}

export default function DashboardPage() {
  const [evals, setEvals] = useState<EvalEntry[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading dashboard…
      </div>
    )
  }

  // Compute per-run stats
  const runMap = new Map<string, Run>(runs.map(r => [r.id, r]))

  // Evals with a runId
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
    const blockingCount = runEvals.filter(e => e.tags.some(t => BLOCKING_TAGS.includes(t))).length
    const tagBreakdown: Record<string, number> = {}
    for (const e of runEvals) {
      for (const t of e.tags) {
        tagBreakdown[t] = (tagBreakdown[t] ?? 0) + 1
      }
    }
    runStats.push({
      run,
      total: runEvals.length,
      passCount,
      passRate,
      avgRating,
      blockingCount,
      tagBreakdown,
      mode: run.mode,
    })
  }

  runStats.sort((a, b) => new Date(a.run.createdAt).getTime() - new Date(b.run.createdAt).getTime())

  // Overall stats (all evals)
  const withThumbs = evals.filter(e => e.thumbs !== null)
  const totalPass = withThumbs.filter(e => e.thumbs === 'up').length
  const overallPassRate = withThumbs.length > 0 ? (totalPass / withThumbs.length) * 100 : 0
  const ratedAll = evals.filter(e => e.rating !== null)
  const overallAvgRating =
    ratedAll.length > 0
      ? ratedAll.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedAll.length
      : 0
  const allTagBreakdown: Record<string, number> = {}
  for (const e of evals) {
    for (const t of e.tags) {
      allTagBreakdown[t] = (allTagBreakdown[t] ?? 0) + 1
    }
  }
  const sortedTags = Object.entries(allTagBreakdown).sort((a, b) => b[1] - a[1])

  // Chart data: runs sorted by date
  const chartData: ChartDataPoint[] = runStats.map(rs => ({
    label: rs.run.name,
    passRate: rs.passRate,
    model: rs.run.model,
    mode: rs.mode,
  }))

  const bestRun = [...runStats].sort((a, b) => b.passRate - a.passRate)[0]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
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
        {/* Progress Chart */}
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
              ▶ Run batch
            </a>
          </div>
          <ProgressChart data={chartData} />
          {/* Model legend */}
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

        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total Evals</p>
            <p className="text-3xl font-bold text-white">{evals.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Overall Pass Rate</p>
            <p className={`text-3xl font-bold ${overallPassRate >= 70 ? 'text-green-400' : overallPassRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
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

        {/* Run comparison table */}
        {runStats.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Run Comparison</h2>
              <span className="text-xs text-gray-600">Sorted by date · best pass rate highlighted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3">Run</th>
                    <th className="text-left px-4 py-3">Model</th>
                    <th className="text-center px-4 py-3">Mode</th>
                    <th className="text-center px-4 py-3">Evals</th>
                    <th className="text-center px-4 py-3">Pass Rate</th>
                    <th className="text-center px-4 py-3">Avg Rating</th>
                    <th className="text-center px-4 py-3">Blocking</th>
                  </tr>
                </thead>
                <tbody>
                  {runStats.map(rs => {
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
                              <p className="text-white font-medium">{rs.run.name}</p>
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
                          {rs.mode === 'batch' ? (
                            <span className="text-xs bg-indigo-900/40 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full">
                              batch
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">manual</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center text-gray-300">{rs.total}</td>
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
                        <td className="px-4 py-4 text-center text-yellow-400">
                          {rs.avgRating > 0 ? rs.avgRating.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {rs.blockingCount > 0 ? (
                            <span className="text-red-400 font-medium">{rs.blockingCount}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Failure analysis */}
        {sortedTags.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Failure Analysis</h2>
            <div className="space-y-2">
              {sortedTags.map(([tag, count]) => {
                const pct = evals.length > 0 ? (count / evals.length) * 100 : 0
                const isBlocking = BLOCKING_TAGS.includes(tag)
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 flex items-center gap-1.5">
                      <span
                        className={`text-xs font-medium ${
                          isBlocking ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {tag}
                      </span>
                      {isBlocking && (
                        <span className="text-[9px] bg-red-950/50 text-red-500 border border-red-900 px-1 py-0.5 rounded">
                          blocking
                        </span>
                      )}
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

        {/* All evals table */}
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
                    <th className="text-center px-4 py-3">Score</th>
                    <th className="text-left px-4 py-3">Tags</th>
                    <th className="text-left px-4 py-3">Notes</th>
                    <th className="text-right px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[...evals].reverse().map(e => (
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-3 max-w-xs">
                        <p className="text-xs text-gray-400 line-clamp-2">{e.userMessage}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{e.runName ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.thumbs === 'up' ? (
                          <span className="text-base">👍</span>
                        ) : e.thumbs === 'down' ? (
                          <span className="text-base">👎</span>
                        ) : e.autoGrade ? (
                          <span className={`text-xs font-medium ${e.autoGrade.verdict === 'pass' ? 'text-green-400' : 'text-red-400'}`}>
                            {e.autoGrade.verdict === 'pass' ? '✓' : '✗'} AI
                          </span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.rating !== null && e.rating !== undefined ? (
                          <span className="text-yellow-400 text-xs">{'★'.repeat(e.rating)}</span>
                        ) : e.autoGrade ? (
                          <span className="text-xs text-indigo-400">{e.autoGrade.score}/5</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {e.tags.map(t => (
                            <span
                              key={t}
                              className="text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-gray-600 line-clamp-2 italic">
                          {e.autoGrade?.reasoning ?? e.comment ?? ''}
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
    </div>
  )
}

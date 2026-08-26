'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import EvalRunReview from '@/components/EvalRunReview'
import EvalSetUpload from '@/components/EvalSetUpload'
import type { AgentConfig, EvalEntry, EvalSet, Run } from '@/lib/types'

const DEFAULT_CONFIG: AgentConfig = {
  name: 'Nordic Knots Marketing Finance Controller',
  systemPrompt: 'You are a finance controller specialized in digital marketing for www.nordicknots.com.',
  model: 'claude-opus-5',
  annotationGuide: '',
  source: 'claude-console',
  deploymentName: 'Nordic Knots',
}

type Tab = 'sets' | 'review'
type BatchState = 'idle' | 'config' | 'running' | 'done'

export default function TestSuitePage() {
  const [tab, setTab] = useState<Tab>('sets')
  const [sets, setSets] = useState<EvalSet[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [consoleMeta, setConsoleMeta] = useState<{ deploymentId?: string; deploymentName?: string }>({})
  const [loading, setLoading] = useState(true)

  const [batchState, setBatchState] = useState<BatchState>('idle')
  const [batchRunName, setBatchRunName] = useState('')
  const [batchRunDesc, setBatchRunDesc] = useState('')
  const [batchProgress, setBatchProgress] = useState(0)
  const cancelRef = useRef(false)

  const [runs, setRuns] = useState<Run[]>([])
  const [evals, setEvals] = useState<EvalEntry[]>([])
  const [reviewRunId, setReviewRunId] = useState<string | null>(null)

  const selected = sets.find(s => s.id === selectedId) ?? sets[0] ?? null

  useEffect(() => {
    const stored = localStorage.getItem('evalEasy_agentConfig')
    let parsed: Partial<AgentConfig> = {}
    if (stored) {
      try { parsed = JSON.parse(stored) } catch { /* ignore */ }
    }

    Promise.all([
      fetch('/api/eval-sets').then(r => r.json()),
      fetch('/api/runs').then(r => r.json()),
      fetch('/api/evals').then(r => r.json()),
      fetch('/api/agent-config').then(r => r.json()).catch(() => null),
    ]).then(([setData, runData, evalData, remote]) => {
      setSets(setData)
      setSelectedId(setData[0]?.id ?? null)
      setRuns(runData)
      setEvals(evalData)
      if (remote?.source === 'claude-console') {
        setAgentConfig({
          name: parsed.name || remote.name || DEFAULT_CONFIG.name,
          systemPrompt: remote.systemPrompt ?? DEFAULT_CONFIG.systemPrompt,
          model: remote.model ?? DEFAULT_CONFIG.model,
          annotationGuide: parsed.annotationGuide || DEFAULT_CONFIG.annotationGuide,
          source: 'claude-console',
          deploymentName: remote.deploymentName,
        })
        setConsoleMeta({ deploymentId: remote.deploymentId, deploymentName: remote.deploymentName })
      } else {
        setAgentConfig({ ...DEFAULT_CONFIG, ...parsed })
      }
      setLoading(false)
    })
  }, [])

  const reviewEvals = useMemo(
    () => evals.filter(e => (reviewRunId ? e.runId === reviewRunId : true) && e.evalSetId).sort((a, b) => a.turnIndex - b.turnIndex),
    [evals, reviewRunId],
  )

  const setRunsForSelected = runs
    .filter(r => r.evalSetId === selected?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const runBatch = async () => {
    if (!selected || selected.rows.length === 0) return
    cancelRef.current = false
    setBatchState('running')
    setBatchProgress(0)

    const runRes = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: batchRunName || `${selected.name} · ${new Date().toLocaleDateString()}`,
        description: batchRunDesc,
        systemPrompt: agentConfig.systemPrompt,
        model: agentConfig.model,
        agentName: agentConfig.name,
        mode: 'batch',
        evalSetId: selected.id,
        evalSetName: selected.name,
        agentSource: agentConfig.source,
        deploymentId: consoleMeta.deploymentId,
        deploymentName: agentConfig.deploymentName ?? consoleMeta.deploymentName,
        rowCount: selected.rows.length,
        sourceFile: selected.sourceFile,
      }),
    })
    const run: Run = await runRes.json()
    setRuns(prev => [...prev, run])

    const created: EvalEntry[] = []
    for (let i = 0; i < selected.rows.length; i++) {
      if (cancelRef.current) break
      const row = selected.rows[i]
      let agentResponse = ''
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: row.question }],
            systemPrompt: agentConfig.systemPrompt,
            model: agentConfig.model,
          }),
        })
        const chatData = await chatRes.json()
        agentResponse = chatData.response ?? chatData.error ?? ''
      } catch {
        agentResponse = 'Error: could not reach agent.'
      }

      let score = 3
      let verdict: 'pass' | 'fail' = 'pass'
      let reasoning = 'Could not auto-grade.'
      try {
        const gradeRes = await fetch('/api/evals/autograde', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: row.question,
            response: agentResponse,
            expectedAnswer: row.expected,
            annotationGuide: row.notes || agentConfig.annotationGuide,
          }),
        })
        const gradeData = await gradeRes.json()
        score = gradeData.score
        verdict = gradeData.verdict
        reasoning = gradeData.reasoning
      } catch { /* defaults */ }

      const savedRes = await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: run.id,
          runId: run.id,
          runName: run.name,
          turnIndex: i + 1,
          userMessage: row.question,
          agentResponse,
          expectedAnswer: row.expected,
          thumbs: verdict === 'pass' ? 'up' : 'down',
          rating: score as 1 | 2 | 3 | 4 | 5,
          tags: [],
          comment: '',
          agentName: agentConfig.name,
          systemPrompt: agentConfig.systemPrompt,
          model: agentConfig.model,
          questionId: row.id,
          evalSetId: selected.id,
          evalSetName: selected.name,
          autoGrade: { score, verdict, reasoning },
        }),
      })
      const saved: EvalEntry = await savedRes.json()
      created.push(saved)
      setEvals(prev => [...prev, saved])
      setBatchProgress(i + 1)
    }

    setBatchState('done')
    setReviewRunId(run.id)
  }

  const passCount = reviewEvals.filter(e => e.thumbs === 'up' || e.autoGrade?.verdict === 'pass').length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 overflow-y-auto">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Chat</a>
            <span className="text-gray-700">|</span>
            <span className="text-base font-semibold text-white">Eval Sets</span>
            <span className="text-gray-700">|</span>
            <a href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm">Dashboard</a>
          </div>
          <div className="flex items-center gap-2">
            {(['sets', 'review'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg border capitalize ${
                  tab === t ? 'border-indigo-500 text-white bg-indigo-950/40' : 'border-gray-700 text-gray-500'
                }`}
              >
                {t === 'sets' ? 'Sets & run' : 'Review'}
              </button>
            ))}
            <button
              onClick={() => setBatchState('config')}
              disabled={!selected || selected.rows.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium px-4 py-2 rounded-xl"
            >
              ▶ Run {selected ? selected.rows.length : 0} rows
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-sm text-gray-400">
            Agent: <span className="text-white font-medium">{agentConfig.name}</span>
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">{agentConfig.model}</span>
          {agentConfig.source === 'claude-console' && (
            <span className="text-xs text-indigo-300">Console · {agentConfig.deploymentName}</span>
          )}
          <a href="/" className="ml-auto text-xs text-indigo-400 hover:text-indigo-300">Change agent →</a>
        </div>

        {tab === 'sets' && (
          <>
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">Eval sets</h1>
              <p className="text-sm text-gray-500">
                Upload CSV, Excel, Word, PowerPoint, or PDF. We map Question / Expected answer columns, then you pick an agent and run every row.
              </p>
            </div>

            <EvalSetUpload
              onSaved={set => {
                setSets(prev => {
                  const i = prev.findIndex(s => s.id === set.id)
                  if (i >= 0) {
                    const next = [...prev]
                    next[i] = set
                    return next
                  }
                  return [set, ...prev]
                })
                setSelectedId(set.id)
              }}
            />

            {loading ? (
              <p className="text-sm text-gray-600 py-8 text-center">Loading…</p>
            ) : (
              <div className="grid lg:grid-cols-[260px_1fr] gap-4">
                <div className="space-y-2">
                  {sets.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left rounded-xl border px-3 py-3 ${
                        selected?.id === s.id
                          ? 'border-indigo-500 bg-indigo-950/30'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <p className="text-sm text-white font-medium">{s.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {s.rows.length} rows · {s.sourceType.toUpperCase()}
                      </p>
                    </button>
                  ))}
                </div>

                {selected && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selected.description || selected.sourceFile} · {selected.rows.length} questions
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await fetch('/api/eval-sets', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: selected.id }),
                          })
                          setSets(prev => prev.filter(s => s.id !== selected.id))
                          setSelectedId(sets.find(s => s.id !== selected.id)?.id ?? null)
                        }}
                        className="text-xs text-red-700 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-wider">
                            <th className="text-left px-4 py-2">#</th>
                            <th className="text-left px-4 py-2">Question</th>
                            <th className="text-left px-4 py-2">Expected</th>
                            <th className="text-left px-4 py-2">Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.rows.map(row => (
                            <tr key={row.id} className="border-b border-gray-800/50 align-top">
                              <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{row.id}</td>
                              <td className="px-4 py-3 text-xs text-gray-200 max-w-md">{row.question}</td>
                              <td className="px-4 py-3 text-xs text-gray-400 max-w-sm whitespace-pre-wrap">{row.expected || '—'}</td>
                              <td className="px-4 py-3">
                                <span className="text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
                                  {row.category}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {setRunsForSelected.length > 0 && (
                      <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
                        {setRunsForSelected.length} run{setRunsForSelected.length === 1 ? '' : 's'} on this set —
                        latest {new Date(setRunsForSelected[0].createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'review' && (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-white mb-1">Review rows</h1>
                <p className="text-sm text-gray-500">Open a row to compare expected vs agent output, then pass/fail and comment.</p>
              </div>
              <select
                value={reviewRunId ?? ''}
                onChange={e => setReviewRunId(e.target.value || null)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">All eval-set runs</option>
                {runs.filter(r => r.evalSetId).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.agentName}
                  </option>
                ))}
              </select>
            </div>
            {reviewEvals.length > 0 && (
              <p className="text-xs text-gray-500">
                {passCount}/{reviewEvals.length} passing ({Math.round((passCount / reviewEvals.length) * 100)}%)
              </p>
            )}
            <EvalRunReview
              evals={reviewEvals}
              onChange={updated => {
                setEvals(prev => prev.map(e => e.id === updated.id ? updated : e))
              }}
            />
          </div>
        )}
      </main>

      {batchState !== 'idle' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            {batchState === 'config' && selected && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Run eval set</h2>
                  <button onClick={() => setBatchState('idle')} className="text-gray-600 hover:text-gray-300 text-2xl leading-none">×</button>
                </div>
                <p className="text-xs text-gray-500">
                  {selected.rows.length} questions from <span className="text-gray-300">{selected.name}</span> will be sent to{' '}
                  <span className="text-gray-300">{agentConfig.name}</span>
                  {agentConfig.source === 'claude-console' ? ' (Claude Console)' : ''}. Each row is auto-graded against the expected answer, then you can review and comment.
                </p>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Run name</label>
                  <input
                    value={batchRunName}
                    onChange={e => setBatchRunName(e.target.value)}
                    placeholder={`${agentConfig.name.split(' ')[0]} · ${selected.name}`}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm outline-none placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">What changed? (optional)</label>
                  <input
                    value={batchRunDesc}
                    onChange={e => setBatchRunDesc(e.target.value)}
                    placeholder="e.g. Console agent v2 — tighter Q1 month definition"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm outline-none placeholder-gray-600"
                  />
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-800/40 px-3 py-2.5 text-xs text-gray-400">
                  Stored with this run: agent, model, {agentConfig.source === 'claude-console' ? 'Console deployment, ' : ''}eval set, row count, timestamp.
                </div>
                <div className="flex gap-3">
                  <button onClick={runBatch} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl">
                    Start run
                  </button>
                  <button onClick={() => setBatchState('idle')} className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
                </div>
              </>
            )}

            {batchState === 'running' && selected && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Running…</h2>
                  <button onClick={() => { cancelRef.current = true }} className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 px-3 py-1.5 rounded-lg">
                    Cancel
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{batchProgress} / {selected.rows.length}</span>
                    <span>{Math.round((batchProgress / selected.rows.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(batchProgress / selected.rows.length) * 100}%` }} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Console agent turns can take a few minutes each. Leave this open.
                </p>
              </>
            )}

            {batchState === 'done' && (
              <>
                <h2 className="text-base font-semibold text-white">Run complete</h2>
                <p className="text-sm text-gray-400">
                  Results are saved with agent / eval-set metadata for hill-climbing on the dashboard.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setBatchState('idle')
                      setTab('review')
                    }}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
                  >
                    Review rows
                  </button>
                  <a href="/dashboard" className="px-5 py-2.5 text-indigo-300 text-sm">Dashboard →</a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

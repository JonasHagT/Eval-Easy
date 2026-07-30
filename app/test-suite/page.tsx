'use client'

import { useState, useEffect, useRef } from 'react'
import { TestQuestion, Agent } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'
import InviteModal from '@/components/InviteModal'

const CATEGORIES = [
  'General',
  'Follow-up',
  'Cold outreach',
  'Declining',
  'Complaints',
  'Onboarding',
  'Sales',
  'Internal',
]

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Recommended — balanced speed & quality' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', desc: 'Most capable — best for complex tasks' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fastest — great for quick tests' },
]

interface BatchResult {
  questionId: string
  question: string
  response: string
  score: number
  verdict: 'pass' | 'fail'
  reasoning: string
}

type BatchState = 'idle' | 'config' | 'running' | 'done'

const ACTIVE_KEY = 'evalEasy_activeAgentId'

export default function TestSuitePage() {
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formQuestion, setFormQuestion] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formCategory, setFormCategory] = useState('General')
  const [showAddForm, setShowAddForm] = useState(false)

  const [batchState, setBatchState] = useState<BatchState>('idle')
  const [batchRunName, setBatchRunName] = useState('')
  const [batchRunDesc, setBatchRunDesc] = useState('')
  const [batchModel, setBatchModel] = useState('claude-sonnet-4-6')
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [batchRunId, setBatchRunId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const cancelRef = useRef(false)

  const loadQuestions = (agentId?: string) => {
    const q = agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''
    return fetch(`/api/test-suite${q}`)
      .then(r => r.json())
      .then((data: TestQuestion[]) => setQuestions(data))
  }

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then((list: Agent[]) => {
        setAgents(list)
        const storedId = localStorage.getItem(ACTIVE_KEY)
        const found = list.find(a => a.id === storedId) ?? list[0]
        if (found) {
          setAgent(found)
          setBatchModel(found.model)
          localStorage.setItem(ACTIVE_KEY, found.id)
          return loadQuestions(found.id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const switchAgent = (a: Agent) => {
    setAgent(a)
    localStorage.setItem(ACTIVE_KEY, a.id)
    setBatchModel(a.model)
    setLoading(true)
    loadQuestions(a.id).finally(() => setLoading(false))
  }

  const saveQuestion = async () => {
    if (!agent) return
    const res = await fetch('/api/test-suite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId ?? uuidv4(),
        question: formQuestion,
        notes: formNotes,
        category: formCategory,
        agentId: agent.id,
      }),
    })
    const saved: TestQuestion = await res.json()
    setQuestions(prev => {
      const i = prev.findIndex(x => x.id === saved.id)
      if (i >= 0) {
        const next = [...prev]
        next[i] = saved
        return next
      }
      return [...prev, saved]
    })
    resetForm()
  }

  const deleteQuestion = async (id: string) => {
    await fetch('/api/test-suite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const startEdit = (q: TestQuestion) => {
    setEditingId(q.id)
    setFormQuestion(q.question)
    setFormNotes(q.notes)
    setFormCategory(q.category)
    setShowAddForm(false)
  }

  const resetForm = () => {
    setEditingId(null)
    setShowAddForm(false)
    setFormQuestion('')
    setFormNotes('')
    setFormCategory('General')
  }

  const runBatch = async () => {
    if (questions.length === 0 || !agent) return
    cancelRef.current = false
    setBatchState('running')
    setBatchProgress(0)
    setBatchResults([])

    const runRes = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: batchRunName || `Batch ${new Date().toLocaleDateString()}`,
        description: batchRunDesc,
        systemPrompt: agent.instructions,
        model: batchModel,
        agentName: agent.name,
        agentId: agent.id,
        mode: 'batch',
      }),
    })
    const run = await runRes.json()
    setBatchRunId(run.id)

    const results: BatchResult[] = []

    for (let i = 0; i < questions.length; i++) {
      if (cancelRef.current) break
      const q = questions[i]

      let agentResponse = ''
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: q.question }],
            agentId: agent.id,
            instructions: agent.instructions,
            model: batchModel,
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
            question: q.question,
            response: agentResponse,
            annotationGuide: q.notes || agent.scoreGuide,
            passThreshold: agent.passThreshold,
          }),
        })
        const gradeData = await gradeRes.json()
        score = gradeData.score
        verdict = gradeData.verdict
        reasoning = gradeData.reasoning
      } catch {
        /* defaults */
      }

      await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: run.id,
          runId: run.id,
          runName: run.name,
          turnIndex: i + 1,
          userMessage: q.question,
          agentResponse,
          thumbs: verdict === 'pass' ? 'up' : 'down',
          rating: score as 1 | 2 | 3 | 4 | 5,
          tags: [],
          comment: '',
          agentName: agent.name,
          agentId: agent.id,
          systemPrompt: agent.instructions,
          model: batchModel,
          questionId: q.id,
          autoGrade: { score, verdict, reasoning },
          reviewStatus: 'pending_review',
        }),
      })

      results.push({
        questionId: q.id,
        question: q.question,
        response: agentResponse,
        score,
        verdict,
        reasoning,
      })
      setBatchResults([...results])
      setBatchProgress(i + 1)
    }

    setBatchState('done')
  }

  const passCount = batchResults.filter(r => r.verdict === 'pass').length
  const passRate =
    batchResults.length > 0 ? Math.round((passCount / batchResults.length) * 100) : 0
  const avgScore =
    batchResults.length > 0
      ? (batchResults.reduce((s, r) => s + r.score, 0) / batchResults.length).toFixed(1)
      : '—'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ← Chat
            </a>
            <span className="text-gray-700">|</span>
            <span className="text-base font-semibold text-white">Test Bank</span>
            <span className="text-gray-700">|</span>
            <a href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              Dashboard
            </a>
          </div>
          <button
            onClick={() => setBatchState('config')}
            disabled={questions.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <span>▶</span>
            <span>Run tests ({questions.length})</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white mb-1">Test Bank</h1>
          <p className="text-sm text-gray-500">
            Reusable questions for this agent. Add notes on what a good answer looks like — reviewers
            and the AI grader both use them.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-sm text-gray-400">
            Testing:{' '}
            <select
              value={agent?.id ?? ''}
              onChange={e => {
                const a = agents.find(x => x.id === e.target.value)
                if (a) switchAgent(a)
              }}
              className="bg-transparent text-white font-medium outline-none border-b border-gray-700 ml-1"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id} className="bg-gray-900">
                  {a.name}
                </option>
              ))}
            </select>
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">
            {agent?.connection === 'api' ? 'External API' : agent?.model}
          </span>
          <a href="/" className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Manage agents →
          </a>
        </div>

        <div className="mb-6">
          {!showAddForm && editingId === null ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full border border-dashed border-gray-700 hover:border-indigo-600 text-gray-600 hover:text-indigo-400 rounded-xl py-3 text-sm transition-colors"
            >
              + Add test question
            </button>
          ) : (
            <div className="bg-gray-900 border border-indigo-700/50 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                {editingId ? 'Edit question' : 'New test question'}
              </h3>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                  Question
                </label>
                <textarea
                  value={formQuestion}
                  onChange={e => setFormQuestion(e.target.value)}
                  placeholder="e.g. Write a follow-up email to a client who hasn't responded in 2 weeks."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none resize-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                  What does a good answer look like?
                </label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Describe the ideal response. Reviewers see this next to the draft."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none resize-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={saveQuestion}
                  disabled={!formQuestion.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {editingId ? 'Save changes' : 'Add question'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-600 text-sm">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500">No test questions yet for this agent.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`bg-gray-900 border rounded-xl p-4 transition-colors ${
                  editingId === q.id ? 'border-indigo-600' : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-medium text-gray-600">#{idx + 1}</span>
                      <span className="text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
                        {q.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed">{q.question}</p>
                    {q.notes && (
                      <p className="text-xs text-gray-600 mt-1.5 italic leading-relaxed">
                        Good answer: {q.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(q)}
                      className="text-xs text-gray-600 hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="text-xs text-red-700 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-950/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {batchState !== 'idle' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            {batchState === 'config' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Run all tests</h2>
                  <button
                    onClick={() => setBatchState('idle')}
                    className="text-gray-600 hover:text-gray-300 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  All {questions.length} questions will be sent to the agent and auto-graded. Then
                  you can invite a specialist to review.
                </p>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    Run name
                  </label>
                  <input
                    value={batchRunName}
                    onChange={e => setBatchRunName(e.target.value)}
                    placeholder={`Batch ${new Date().toLocaleDateString()}`}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    Notes <span className="text-gray-700 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    value={batchRunDesc}
                    onChange={e => setBatchRunDesc(e.target.value)}
                    placeholder="e.g. Testing clearer CTA instructions"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none"
                  />
                </div>
                {agent?.connection !== 'api' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                      Which AI to test
                    </label>
                    <div className="space-y-2">
                      {MODELS.map(m => (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            batchModel === m.id
                              ? 'border-indigo-500 bg-indigo-950/30'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name="model"
                            value={m.id}
                            checked={batchModel === m.id}
                            onChange={() => setBatchModel(m.id)}
                            className="accent-indigo-500"
                          />
                          <div>
                            <p className="text-sm text-gray-200 font-medium">{m.label}</p>
                            <p className="text-xs text-gray-500">{m.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={runBatch}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
                  >
                    Start run
                  </button>
                  <button
                    onClick={() => setBatchState('idle')}
                    className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {batchState === 'running' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Running tests…</h2>
                  <button
                    onClick={() => {
                      cancelRef.current = true
                    }}
                    className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-700 px-3 py-1.5 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>
                      {batchProgress} / {questions.length}
                    </span>
                    <span>
                      {questions.length > 0
                        ? Math.round((batchProgress / questions.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${questions.length > 0 ? (batchProgress / questions.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batchResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={r.verdict === 'pass' ? 'text-green-400' : 'text-red-400'}>
                        {r.verdict === 'pass' ? '✓' : '✗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 line-clamp-1">{r.question}</p>
                        <p className="text-gray-600 italic line-clamp-1">{r.reasoning}</p>
                      </div>
                      <span className="text-gray-600 shrink-0">{r.score}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {batchState === 'done' && batchRunId && (
              <div className="p-6 space-y-5">
                <h2 className="text-base font-semibold text-white">Run complete</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Pass Rate</p>
                    <p
                      className={`text-3xl font-bold ${
                        passRate >= 70
                          ? 'text-green-400'
                          : passRate >= 40
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }`}
                    >
                      {passRate}%
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Avg Score</p>
                    <p className="text-3xl font-bold text-indigo-400">{avgScore}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Next: invite a domain specialist to review the drafts, or open the run overall.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowInvite(true)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
                  >
                    Invite reviewer
                  </button>
                  <a
                    href={`/runs/${batchRunId}`}
                    className="w-full py-2.5 text-center text-gray-300 border border-gray-700 hover:border-gray-500 text-sm font-medium rounded-xl"
                  >
                    Open run overall →
                  </a>
                  <button
                    onClick={() => {
                      setBatchState('idle')
                      setBatchRunName('')
                      setBatchRunDesc('')
                      setBatchResults([])
                      setBatchProgress(0)
                    }}
                    className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showInvite && batchRunId && agent && (
        <InviteModal
          runId={batchRunId}
          runName={batchRunName || 'Batch run'}
          agentId={agent.id}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  )
}

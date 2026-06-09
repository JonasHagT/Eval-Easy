'use client'

import { useState, useEffect, useRef } from 'react'
import { TestQuestion, AgentConfig } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

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

const DEFAULT_CONFIG: AgentConfig = {
  name: 'Email Assistant',
  systemPrompt: 'You are a professional email writing assistant. Help users craft clear, effective, and persuasive emails for any situation.',
  model: 'claude-sonnet-4-6',
  annotationGuide: '',
}

interface BatchResult {
  questionId: string
  question: string
  response: string
  score: number
  verdict: 'pass' | 'fail'
  reasoning: string
}

type BatchState = 'idle' | 'config' | 'running' | 'done'

export default function TestSuitePage() {
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(DEFAULT_CONFIG)

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formQuestion, setFormQuestion] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formCategory, setFormCategory] = useState('General')
  const [showAddForm, setShowAddForm] = useState(false)

  // Batch state
  const [batchState, setBatchState] = useState<BatchState>('idle')
  const [batchRunName, setBatchRunName] = useState('')
  const [batchRunDesc, setBatchRunDesc] = useState('')
  const [batchModel, setBatchModel] = useState('claude-sonnet-4-6')
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [batchRunId, setBatchRunId] = useState<string | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem('evalEasy_agentConfig')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setAgentConfig({ ...DEFAULT_CONFIG, ...parsed })
        setBatchModel(parsed.model ?? DEFAULT_CONFIG.model)
      } catch { /* ignore */ }
    }
    fetch('/api/test-suite')
      .then(r => r.json())
      .then((data: TestQuestion[]) => {
        setQuestions(data)
        setLoading(false)
      })
  }, [])

  const saveQuestion = async (q: Partial<TestQuestion> & { id?: string }) => {
    const res = await fetch('/api/test-suite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: q.id ?? uuidv4(),
        question: formQuestion,
        notes: formNotes,
        category: formCategory,
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
    if (questions.length === 0) return
    cancelRef.current = false
    setBatchState('running')
    setBatchProgress(0)
    setBatchResults([])

    // Create a run record
    const runRes = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: batchRunName || `Batch ${new Date().toLocaleDateString()}`,
        description: batchRunDesc,
        systemPrompt: agentConfig.systemPrompt,
        model: batchModel,
        agentName: agentConfig.name,
        mode: 'batch',
      }),
    })
    const run = await runRes.json()
    setBatchRunId(run.id)

    const results: BatchResult[] = []

    for (let i = 0; i < questions.length; i++) {
      if (cancelRef.current) break
      const q = questions[i]

      // 1. Get agent response
      let agentResponse = ''
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: q.question }],
            systemPrompt: agentConfig.systemPrompt,
            model: batchModel,
          }),
        })
        const chatData = await chatRes.json()
        agentResponse = chatData.response ?? ''
      } catch {
        agentResponse = 'Error: could not reach agent.'
      }

      // 2. Auto-grade
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
            annotationGuide: q.notes || agentConfig.annotationGuide,
          }),
        })
        const gradeData = await gradeRes.json()
        score = gradeData.score
        verdict = gradeData.verdict
        reasoning = gradeData.reasoning
      } catch { /* use defaults */ }

      // 3. Save eval
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
          agentName: agentConfig.name,
          systemPrompt: agentConfig.systemPrompt,
          model: batchModel,
          questionId: q.id,
          autoGrade: { score, verdict, reasoning },
        }),
      })

      const result: BatchResult = {
        questionId: q.id,
        question: q.question,
        response: agentResponse,
        score,
        verdict,
        reasoning,
      }
      results.push(result)
      setBatchResults([...results])
      setBatchProgress(i + 1)
    }

    setBatchState('done')
  }

  const passCount = batchResults.filter(r => r.verdict === 'pass').length
  const passRate = batchResults.length > 0 ? Math.round((passCount / batchResults.length) * 100) : 0
  const avgScore =
    batchResults.length > 0
      ? (batchResults.reduce((s, r) => s + r.score, 0) / batchResults.length).toFixed(1)
      : '—'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
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
            <span>Run Batch ({questions.length})</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Intro */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white mb-1">Test Bank</h1>
          <p className="text-sm text-gray-500">
            Build a reusable set of questions to test your agent. Include notes about what a good answer looks like — these guide the AI auto-grader.
          </p>
        </div>

        {/* Agent context bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-sm text-gray-400">
            Testing: <span className="text-white font-medium">{agentConfig.name}</span>
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">{agentConfig.model}</span>
          <a href="/" className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Change agent →
          </a>
        </div>

        {/* Add question form */}
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
                  placeholder="What should the agent be asked? e.g. Write a follow-up email to a client who hasn't responded in 2 weeks."
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
                  placeholder="Describe what the ideal response should include, avoid, or achieve. This is used by the AI auto-grader."
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
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => saveQuestion({ id: editingId ?? undefined })}
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

        {/* Question list */}
        {loading ? (
          <div className="text-center py-16 text-gray-600 text-sm">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">📋</div>
            <p className="text-sm text-gray-500">No test questions yet.</p>
            <p className="text-xs text-gray-600 mt-1">
              Add questions above to build your test bank.
            </p>
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

      {/* Batch Modal */}
      {batchState !== 'idle' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Config state */}
            {batchState === 'config' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Run Batch Test</h2>
                  <button
                    onClick={() => setBatchState('idle')}
                    className="text-gray-600 hover:text-gray-300 text-2xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  All {questions.length} questions will be sent to the agent and auto-graded. Results are saved to the dashboard.
                </p>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    Run name
                  </label>
                  <input
                    value={batchRunName}
                    onChange={e => setBatchRunName(e.target.value)}
                    placeholder={`Batch ${new Date().toLocaleDateString()}`}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    Notes <span className="text-gray-700 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    value={batchRunDesc}
                    onChange={e => setBatchRunDesc(e.target.value)}
                    placeholder="e.g. Testing new system prompt with more context"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Model to test
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

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={runBatch}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Start Run
                  </button>
                  <button
                    onClick={() => setBatchState('idle')}
                    className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Running state */}
            {batchState === 'running' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Running batch…</h2>
                  <button
                    onClick={() => { cancelRef.current = true }}
                    className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{batchProgress} / {questions.length} questions</span>
                    <span>{questions.length > 0 ? Math.round((batchProgress / questions.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${questions.length > 0 ? (batchProgress / questions.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Live results */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batchResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={r.verdict === 'pass' ? 'text-green-400' : 'text-red-400'}>
                        {r.verdict === 'pass' ? '✅' : '❌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 line-clamp-1">{r.question}</p>
                        <p className="text-gray-600 italic line-clamp-1">{r.reasoning}</p>
                      </div>
                      <span className="text-gray-600 shrink-0">{r.score}/5</span>
                    </div>
                  ))}
                </div>

                {batchProgress < questions.length && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Grading question {batchProgress + 1}…</span>
                  </div>
                )}
              </div>
            )}

            {/* Done state */}
            {batchState === 'done' && (
              <div className="p-6 space-y-5">
                <h2 className="text-base font-semibold text-white">Batch complete</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Pass Rate</p>
                    <p className={`text-3xl font-bold ${passRate >= 70 ? 'text-green-400' : passRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {passRate}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{passCount} / {batchResults.length} passed</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Avg Score</p>
                    <p className="text-3xl font-bold text-indigo-400">{avgScore}</p>
                    <p className="text-xs text-gray-600 mt-1">out of 5</p>
                  </div>
                </div>

                {/* Results summary */}
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {batchResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={r.verdict === 'pass' ? 'text-green-400' : 'text-red-400'}>
                        {r.verdict === 'pass' ? '✅' : '❌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 line-clamp-1">{r.question}</p>
                        <p className="text-gray-600 italic line-clamp-1">{r.reasoning}</p>
                      </div>
                      <span className="text-gray-600 shrink-0">{r.score}/5</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-1">
                  <a
                    href="/dashboard"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors text-center"
                  >
                    View in Dashboard →
                  </a>
                  <button
                    onClick={() => {
                      setBatchState('idle')
                      setBatchRunName('')
                      setBatchRunDesc('')
                      setBatchResults([])
                      setBatchProgress(0)
                      setBatchRunId(null)
                    }}
                    className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

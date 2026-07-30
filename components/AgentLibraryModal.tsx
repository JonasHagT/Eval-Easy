'use client'

import { useEffect, useState } from 'react'
import { Agent, DEFAULT_EMAIL_AGENT } from '@/lib/types'

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — recommended' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — most capable' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — fastest' },
]

const inputClass =
  'w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors'

interface Props {
  activeAgentId?: string
  onSelect: (agent: Agent) => void
  onClose: () => void
}

export default function AgentLibraryModal({ activeAgentId, onSelect, onClose }: Props) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Partial<Agent> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () =>
    fetch('/api/agents')
      .then(r => r.json())
      .then(setAgents)

  useEffect(() => {
    load()
  }, [])

  const startNew = () => {
    setEditing({
      ...DEFAULT_EMAIL_AGENT,
      name: '',
      description: '',
    })
  }

  const save = async () => {
    if (!editing?.name?.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const agent = await res.json()
      if (!res.ok) throw new Error(agent.error || 'Save failed')
      await load()
      setEditing(null)
      onSelect(agent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    const res = await fetch('/api/agents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Could not delete')
      return
    }
    await load()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Your agents</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Switch between agents or add a new one. Specialists never see this screen.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-2xl leading-none">
            ×
          </button>
        </div>

        {!editing ? (
          <>
            <div className="space-y-2">
              {agents.map(a => (
                <div
                  key={a.id}
                  className={`border rounded-xl p-4 flex items-start gap-3 transition-colors ${
                    activeAgentId === a.id
                      ? 'border-indigo-500 bg-indigo-950/20'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => {
                      onSelect(a)
                      onClose()
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white">{a.name}</span>
                      {activeAgentId === a.id && (
                        <span className="text-[10px] bg-indigo-900/50 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded-full">
                          active
                        </span>
                      )}
                      <span className="text-[10px] text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded-full">
                        {a.connection === 'api' ? 'External API' : 'Claude'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {a.description || a.instructions}
                    </p>
                  </button>
                  <button
                    onClick={() => setEditing({ ...a })}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    className="text-xs text-red-700 hover:text-red-400 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={startNew}
              className="w-full border border-dashed border-gray-700 hover:border-indigo-600 text-gray-500 hover:text-indigo-400 rounded-xl py-3 text-sm transition-colors"
            >
              + Add agent
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">
              {editing.id ? 'Edit agent' : 'New agent'}
            </h3>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Name
              </label>
              <input
                value={editing.name ?? ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Sales follow-up"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Short description
              </label>
              <input
                value={editing.description ?? ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                placeholder="What this agent is for"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Instructions
              </label>
              <textarea
                value={editing.instructions ?? ''}
                onChange={e => setEditing({ ...editing, instructions: e.target.value })}
                rows={5}
                className={`${inputClass} resize-none font-mono text-[13px] leading-relaxed`}
              />
              <p className="text-xs text-gray-600 mt-1">
                Sent with every conversation. Plain language is fine.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                What does a good answer look like?
              </label>
              <textarea
                value={editing.scoreGuide ?? ''}
                onChange={e => setEditing({ ...editing, scoreGuide: e.target.value })}
                rows={3}
                className={`${inputClass} resize-none`}
              />
              <p className="text-xs text-gray-600 mt-1">
                Shown to reviewers and used by the AI grader.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                How to call this agent
              </label>
              <div className="flex gap-2">
                {(['claude', 'api'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditing({ ...editing, connection: c })}
                    className={`flex-1 py-2.5 text-sm rounded-xl border transition-colors ${
                      editing.connection === c
                        ? 'border-indigo-500 bg-indigo-950/30 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {c === 'claude' ? 'Claude (built-in)' : 'External API'}
                  </button>
                ))}
              </div>
            </div>

            {editing.connection === 'api' ? (
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                  API URL
                </label>
                <input
                  value={editing.apiUrl ?? ''}
                  onChange={e => setEditing({ ...editing, apiUrl: e.target.value })}
                  placeholder="https://your-agent.example.com/chat"
                  className={inputClass}
                />
                <p className="text-xs text-gray-600 mt-1">
                  POST JSON: {'{ messages, instructions }'}. Return {'{ response: string }'}.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                  Model
                </label>
                <select
                  value={editing.model ?? 'claude-sonnet-4-6'}
                  onChange={e => setEditing({ ...editing, model: e.target.value })}
                  className={inputClass}
                >
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Pass threshold
              </label>
              <select
                value={editing.passThreshold ?? 3}
                onChange={e =>
                  setEditing({ ...editing, passThreshold: Number(e.target.value) })
                }
                className={inputClass}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">
                Scores at or above this count as a pass.
              </p>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
              >
                {saving ? 'Saving…' : 'Save agent'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

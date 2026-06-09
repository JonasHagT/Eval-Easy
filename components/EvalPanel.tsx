'use client'

import { useState, useEffect } from 'react'
import { EvalEntry, AgentConfig } from '@/lib/types'

const TAGS: { label: string; sentiment: 'negative' | 'warning' | 'positive' }[] = [
  { label: 'Wrong info', sentiment: 'negative' },
  { label: 'Off-topic', sentiment: 'negative' },
  { label: 'Too long', sentiment: 'warning' },
  { label: 'Too short', sentiment: 'warning' },
  { label: 'Tone off', sentiment: 'warning' },
  { label: 'Missing context', sentiment: 'warning' },
  { label: 'Great answer', sentiment: 'positive' },
  { label: 'Helpful', sentiment: 'positive' },
]

const TAG_STYLES: Record<string, { base: string; selected: string }> = {
  negative: {
    base: 'border-red-800 text-red-400 bg-red-950/30 hover:bg-red-950/60',
    selected: 'border-red-500 text-red-200 bg-red-900/50 ring-1 ring-red-500',
  },
  warning: {
    base: 'border-amber-800 text-amber-400 bg-amber-950/30 hover:bg-amber-950/60',
    selected: 'border-amber-500 text-amber-200 bg-amber-900/50 ring-1 ring-amber-500',
  },
  positive: {
    base: 'border-green-800 text-green-400 bg-green-950/30 hover:bg-green-950/60',
    selected: 'border-green-500 text-green-200 bg-green-900/50 ring-1 ring-green-500',
  },
}

interface PendingEval {
  turnIndex: number
  userMessage: string
  agentResponse: string
}

interface Props {
  pendingEval: PendingEval | null
  config: AgentConfig
  onSave: (
    evalData: Omit<EvalEntry, 'id' | 'createdAt' | 'sessionId' | 'agentName' | 'systemPrompt' | 'runId' | 'runName'>
  ) => Promise<void>
  onSkip: () => void
}

export default function EvalPanel({ pendingEval, config, onSave, onSkip }: Props) {
  const [tab, setTab] = useState<'eval' | 'history'>('eval')
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(null)
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [evals, setEvals] = useState<EvalEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (pendingEval) {
      setTab('eval')
      setThumbs(null)
      setRating(null)
      setHoverRating(null)
      setSelectedTags([])
      setComment('')
    }
  }, [pendingEval])

  useEffect(() => {
    if (tab === 'history') fetchHistory()
  }, [tab])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/evals')
      const data: EvalEntry[] = await res.json()
      setEvals([...data].reverse())
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSave = async () => {
    if (!pendingEval) return
    setSaving(true)
    await onSave({
      turnIndex: pendingEval.turnIndex,
      userMessage: pendingEval.userMessage,
      agentResponse: pendingEval.agentResponse,
      thumbs,
      rating,
      tags: selectedTags,
      comment,
      model: config.model,
    })
    setSaving(false)
  }

  const toggleTag = (label: string) =>
    setSelectedTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    )

  const displayRating = hoverRating ?? rating ?? 0

  return (
    <div className="w-[400px] shrink-0 flex flex-col bg-gray-900/60 min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 shrink-0">
        <button
          onClick={() => setTab('eval')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'eval'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Rate This Turn
          {pendingEval && (
            <span className="ml-2 inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full align-middle animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'history'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          History
        </button>
      </div>

      {/* Eval form */}
      {tab === 'eval' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!pendingEval ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="text-4xl mb-3 opacity-40">✍️</div>
              <p className="text-sm text-gray-500">Waiting for the next response…</p>
              <p className="text-xs text-gray-600 mt-1">
                A rating form appears here automatically after each agent turn.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Turn {pendingEval.turnIndex}
                </span>
              </div>

              {/* Context */}
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">You asked</p>
                  <div className="bg-gray-800/60 rounded-xl px-3 py-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {pendingEval.userMessage}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Agent said</p>
                  <div className="bg-gray-800/60 rounded-xl px-3 py-2 text-xs text-gray-300 max-h-28 overflow-y-auto leading-relaxed">
                    {pendingEval.agentResponse}
                  </div>
                </div>
              </div>

              {/* Thumbs */}
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Quick verdict</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setThumbs(thumbs === 'up' ? null : 'up')}
                    className={`flex-1 py-3 rounded-xl text-xl transition-all border ${
                      thumbs === 'up'
                        ? 'bg-green-900/50 border-green-500 ring-1 ring-green-500'
                        : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800'
                    }`}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => setThumbs(thumbs === 'down' ? null : 'down')}
                    className={`flex-1 py-3 rounded-xl text-xl transition-all border ${
                      thumbs === 'down'
                        ? 'bg-red-900/50 border-red-500 ring-1 ring-red-500'
                        : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800'
                    }`}
                  >
                    👎
                  </button>
                </div>
              </div>

              {/* Star rating */}
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
                  Score <span className="text-gray-700 normal-case font-normal">(optional)</span>
                </p>
                <div
                  className="flex gap-0.5"
                  onMouseLeave={() => setHoverRating(null)}
                >
                  {([1, 2, 3, 4, 5] as const).map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(rating === star ? null : star)}
                      onMouseEnter={() => setHoverRating(star)}
                      className={`flex-1 py-2 text-xl transition-colors ${
                        star <= displayRating ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Issue tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map(({ label, sentiment }) => {
                    const styles = TAG_STYLES[sentiment]
                    return (
                      <button
                        key={label}
                        onClick={() => toggleTag(label)}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${
                          selectedTags.includes(label) ? styles.selected : styles.base
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Comment */}
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
                  Notes <span className="text-gray-700 normal-case font-normal">(optional)</span>
                </p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="What should it have said? Any notes for improving the prompt…"
                  rows={3}
                  className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none resize-none focus:border-indigo-500/60 transition-colors leading-relaxed"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pb-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Eval'}
                </button>
                <button
                  onClick={onSkip}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-400 text-sm transition-colors"
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs text-gray-500">{evals.length} eval{evals.length !== 1 ? 's' : ''} saved</span>
            <a
              href="/api/evals/export"
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-900 hover:border-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Export CSV
            </a>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
                Loading…
              </div>
            ) : evals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-3xl mb-2 opacity-40">📋</div>
                <p className="text-sm text-gray-500">No evals yet.</p>
                <p className="text-xs text-gray-600 mt-1">
                  Rate agent responses to build your eval dataset.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {evals.map(e => (
                  <div key={e.id} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-600">
                          Turn #{e.turnIndex} · {new Date(e.createdAt).toLocaleDateString()}
                        </span>
                        {e.autoGrade && (
                          <span className="text-[10px] bg-indigo-950/50 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded-full">
                            ⚡ AI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {e.thumbs === 'up' && <span className="text-sm">👍</span>}
                        {e.thumbs === 'down' && <span className="text-sm">👎</span>}
                        {e.rating !== null && e.rating !== undefined ? (
                          <span className="text-yellow-400 text-xs">{'★'.repeat(e.rating)}</span>
                        ) : e.autoGrade ? (
                          <span className="text-xs text-indigo-400">{e.autoGrade.score}/5</span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-0.5">
                      <span className="text-gray-700">Q: </span>
                      <span className="line-clamp-1">{e.userMessage}</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      <span className="text-gray-700">A: </span>
                      <span className="line-clamp-1">{e.agentResponse}</span>
                    </p>
                    {e.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {e.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(e.autoGrade?.reasoning || e.comment) && (
                      <p className="text-xs text-gray-500 italic line-clamp-2">
                        "{e.autoGrade?.reasoning ?? e.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

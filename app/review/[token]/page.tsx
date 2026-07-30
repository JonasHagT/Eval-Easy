'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import ScoreForm, { ScoreValues } from '@/components/ScoreForm'
import type { Agent, EvalEntry, Invite, Run } from '@/lib/types'

interface ReviewEval extends EvalEntry {
  questionNotes?: string
}

interface ReviewPayload {
  invite: Invite
  run: Run
  agent?: Agent
  evals: ReviewEval[]
  pending: ReviewEval[]
  reviewed: ReviewEval[]
  stats: {
    total: number
    reviewed: number
    pending: number
    passCount: number
    passRate: number
    avgRating: number
    overrides: number
  }
}

export default function ReviewPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [data, setData] = useState<ReviewPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reviewerName, setReviewerName] = useState('')
  const [nameReady, setNameReady] = useState(false)
  const [index, setIndex] = useState(0)
  const [doneFlash, setDoneFlash] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/review?token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load review')
      setData(json)
      if (json.invite?.suggestedName && !reviewerName) {
        setReviewerName(json.invite.suggestedName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load review')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const pending = data?.pending ?? []
  const current = pending[Math.min(index, Math.max(pending.length - 1, 0))]
  const progressPct = useMemo(() => {
    if (!data || data.stats.total === 0) return 0
    return Math.round((data.stats.reviewed / data.stats.total) * 100)
  }, [data])

  const scoreGuide =
    current?.questionNotes ||
    data?.agent?.scoreGuide ||
    'Judge whether this email is clear, appropriately toned, and ready to send.'

  const submitScore = async (values: ScoreValues) => {
    if (!current) return
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        evalId: current.id,
        ...values,
        reviewedBy: reviewerName.trim() || 'Reviewer',
      }),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Save failed')
    }
    setDoneFlash(true)
    setTimeout(() => setDoneFlash(false), 600)
    await load()
    setIndex(0)
  }

  const skip = async () => {
    if (!current) return
    await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        evalId: current.id,
        skip: true,
        reviewedBy: reviewerName.trim() || 'Reviewer',
      }),
    })
    await load()
    setIndex(0)
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading review…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg font-semibold text-white">Can&apos;t open this invite</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  if (!nameReady) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-xs text-indigo-400 font-medium mb-1">Review invite</p>
            <h1 className="text-xl font-semibold text-white">{data.run.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              You&apos;ll score emails one at a time. {data.stats.pending} left to review
              {data.stats.total > 0 ? ` of ${data.stats.total}` : ''}.
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Your name
            </label>
            <input
              value={reviewerName}
              onChange={e => setReviewerName(e.target.value)}
              placeholder="So we know who scored what"
              className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && reviewerName.trim()) setNameReady(true)
              }}
            />
          </div>
          <button
            onClick={() => setNameReady(true)}
            disabled={!reviewerName.trim()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Start reviewing
          </button>
          <a
            href={`/review/${token}/overall`}
            className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Or view overall results →
          </a>
        </div>
      </div>
    )
  }

  if (pending.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 text-center">
          <div className="text-4xl">✓</div>
          <h1 className="text-xl font-semibold text-white">All caught up</h1>
          <p className="text-sm text-gray-500">
            You&apos;ve reviewed everything in this run. Thanks, {reviewerName}!
          </p>
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Pass rate</p>
              <p className="text-2xl font-bold text-green-400">
                {Math.round(data.stats.passRate)}%
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Reviewed</p>
              <p className="text-2xl font-bold text-white">{data.stats.reviewed}</p>
            </div>
          </div>
          <a
            href={`/review/${token}/overall`}
            className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            See overall results →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
              Reviewing as {reviewerName}
            </p>
            <h1 className="text-sm font-semibold text-white truncate">{data.run.name}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-500">
              {data.stats.reviewed}/{data.stats.total} done
            </span>
            <a
              href={`/review/${token}/overall`}
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-900 hover:border-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Overall
            </a>
          </div>
        </div>
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-2 gap-6">
        {/* Left: email / response */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Item {data.stats.reviewed + 1} of {data.stats.total} · {pending.length} left
            </p>
            {doneFlash && (
              <span className="text-xs text-green-400 animate-pulse">Saved</span>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1.5">
                Prompt
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{current.userMessage}</p>
            </div>
            <div className="border-t border-gray-800 pt-4">
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1.5">
                Email draft
              </p>
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-4 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {current.agentResponse}
              </div>
            </div>
          </div>

          {(current.autoGrade || scoreGuide) && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                Scoring guide
              </p>
              <p className="text-sm text-gray-400 leading-relaxed">{scoreGuide}</p>
              {current.autoGrade && (
                <div className="flex items-start gap-3 pt-2 border-t border-gray-800">
                  <div
                    className={`text-xs font-medium px-2 py-1 rounded-lg border ${
                      current.autoGrade.verdict === 'pass'
                        ? 'bg-green-950/40 text-green-400 border-green-900'
                        : 'bg-red-950/40 text-red-400 border-red-900'
                    }`}
                  >
                    AI: {current.autoGrade.verdict} · {current.autoGrade.score}/5
                  </div>
                  <p className="text-xs text-gray-500 italic flex-1 leading-relaxed">
                    {current.autoGrade.reasoning}
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-600">
                You can agree with the AI grade or override it — your score is what counts.
              </p>
            </div>
          )}
        </section>

        {/* Right: score form */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-fit lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold text-white mb-4">Your score</h2>
          <ScoreForm
            key={current.id}
            initial={{
              thumbs:
                current.autoGrade?.verdict === 'pass'
                  ? 'up'
                  : current.autoGrade?.verdict === 'fail'
                    ? 'down'
                    : null,
              rating: current.autoGrade?.score ?? null,
              tags: [],
              comment: '',
            }}
            onSubmit={submitScore}
            onSkip={skip}
            submitLabel="Save & next"
          />
        </section>
      </main>
    </div>
  )
}

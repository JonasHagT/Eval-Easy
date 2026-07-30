import { NextRequest, NextResponse } from 'next/server'
import { getEvalsByRun, updateEval } from '@/lib/evalStore'
import { getInviteByToken, isInviteValid } from '@/lib/inviteStore'
import { getRun } from '@/lib/runStore'
import { getAgent } from '@/lib/agentStore'
import { readQuestions } from '@/lib/testStore'
import type { EvalEntry } from '@/lib/types'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const runId = req.nextUrl.searchParams.get('runId')

  if (token) {
    const invite = getInviteByToken(token)
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (!isInviteValid(invite)) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
    }
    const run = getRun(invite.runId)
    const evals = getEvalsByRun(invite.runId)
    const agent = invite.agentId
      ? getAgent(invite.agentId)
      : run?.agentId
        ? getAgent(run.agentId)
        : undefined

    const questions = readQuestions(agent?.id)
    const notesById = new Map(questions.map(q => [q.id, q.notes]))
    const notesByText = new Map(questions.map(q => [q.question, q.notes]))
    const enriched = evals.map(e => ({
      ...e,
      questionNotes:
        (e.questionId && notesById.get(e.questionId)) ||
        notesByText.get(e.userMessage) ||
        '',
    }))

    const pending = enriched.filter(
      e => e.reviewStatus !== 'reviewed' && e.reviewStatus !== 'skipped'
    )
    const reviewed = enriched.filter(e => e.reviewStatus === 'reviewed')

    return NextResponse.json({
      invite,
      run,
      agent,
      evals: enriched,
      pending,
      reviewed,
      stats: buildStats(evals, agent?.passThreshold ?? 3),
    })
  }

  if (runId) {
    const run = getRun(runId)
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    const evals = getEvalsByRun(runId)
    const agent = run.agentId ? getAgent(run.agentId) : undefined
    return NextResponse.json({
      run,
      agent,
      evals,
      stats: buildStats(evals, agent?.passThreshold ?? 3),
    })
  }

  return NextResponse.json({ error: 'token or runId required' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, evalId, thumbs, rating, tags, comment, reviewedBy, skip } = body

  if (!token || !evalId) {
    return NextResponse.json({ error: 'token and evalId are required' }, { status: 400 })
  }

  const invite = getInviteByToken(token)
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (!isInviteValid(invite)) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  const evals = getEvalsByRun(invite.runId)
  const entry = evals.find(e => e.id === evalId)
  if (!entry) return NextResponse.json({ error: 'Eval not found for this invite' }, { status: 404 })

  if (skip) {
    const updated = updateEval(evalId, {
      reviewStatus: 'skipped',
      reviewedBy: reviewedBy || invite.suggestedName || 'Reviewer',
      reviewedAt: new Date().toISOString(),
    })
    return NextResponse.json(updated)
  }

  const hadAutoGrade = Boolean(entry.autoGrade)
  const humanDiffers =
    hadAutoGrade &&
    ((thumbs != null &&
      ((entry.autoGrade!.verdict === 'pass' && thumbs === 'down') ||
        (entry.autoGrade!.verdict === 'fail' && thumbs === 'up'))) ||
      (rating != null && rating !== entry.autoGrade!.score))

  const patch: Partial<EvalEntry> = {
    thumbs: thumbs ?? entry.thumbs,
    rating: rating ?? entry.rating,
    tags: tags ?? entry.tags,
    comment: comment ?? entry.comment,
    reviewStatus: 'reviewed',
    reviewedBy: reviewedBy || invite.suggestedName || 'Reviewer',
    reviewedAt: new Date().toISOString(),
    humanOverride: humanDiffers || undefined,
  }

  const updated = updateEval(evalId, patch)
  return NextResponse.json(updated)
}

function buildStats(evals: EvalEntry[], passThreshold: number) {
  const total = evals.length
  const reviewed = evals.filter(e => e.reviewStatus === 'reviewed')
  const pending = evals.filter(e => e.reviewStatus !== 'reviewed' && e.reviewStatus !== 'skipped')
  const withThumbs = evals.filter(e => e.thumbs !== null)
  const passCount = withThumbs.filter(e => e.thumbs === 'up').length
  const passRate = withThumbs.length > 0 ? (passCount / withThumbs.length) * 100 : 0
  const rated = evals.filter(e => e.rating !== null)
  const avgRating =
    rated.length > 0 ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : 0
  const overrides = evals.filter(e => e.humanOverride).length
  const tagBreakdown: Record<string, number> = {}
  for (const e of evals) {
    for (const t of e.tags) tagBreakdown[t] = (tagBreakdown[t] ?? 0) + 1
  }
  const aiPass = evals.filter(e => e.autoGrade?.verdict === 'pass').length
  const aiFail = evals.filter(e => e.autoGrade?.verdict === 'fail').length

  return {
    total,
    reviewed: reviewed.length,
    pending: pending.length,
    passCount,
    passRate,
    avgRating,
    overrides,
    tagBreakdown,
    aiPass,
    aiFail,
    passThreshold,
  }
}

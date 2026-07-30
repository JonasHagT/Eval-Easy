import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { readEvals, saveEval, clearEvals, updateEval } from '@/lib/evalStore'
import type { EvalEntry } from '@/lib/types'

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId')
  const evals = readEvals()
  if (runId) return NextResponse.json(evals.filter(e => e.runId === runId))
  return NextResponse.json(evals)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Update existing eval (e.g. admin override)
  if (body.id && body.update) {
    const { id, update: _u, ...patch } = body
    const updated = updateEval(id, patch)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  const entry: EvalEntry = {
    ...body,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    reviewStatus: body.reviewStatus ?? (body.autoGrade ? 'pending_review' : 'reviewed'),
  }
  saveEval(entry)
  return NextResponse.json(entry, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { id, ...patch } = body
  const updated = updateEval(id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE() {
  clearEvals()
  return NextResponse.json({ ok: true })
}

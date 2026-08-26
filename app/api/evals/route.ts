import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { readEvals, saveEval, clearEvals, updateEval } from '@/lib/evalStore'
import type { EvalEntry } from '@/lib/types'

export async function GET() {
  const evals = readEvals()
  return NextResponse.json(evals)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entry: EvalEntry = {
    ...body,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  }
  saveEval(entry)
  return NextResponse.json(entry, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const { id, ...patch } = body as Partial<EvalEntry> & { id: string }
  const updated = updateEval(id, patch)
  if (!updated) {
    return NextResponse.json({ error: 'Eval not found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE() {
  clearEvals()
  return NextResponse.json({ ok: true })
}

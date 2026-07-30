import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { readQuestions, saveQuestion, deleteQuestion } from '@/lib/testStore'
import type { TestQuestion } from '@/lib/types'

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') ?? undefined
  return NextResponse.json(readQuestions(agentId))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const q: TestQuestion = {
    id: body.id ?? uuidv4(),
    question: body.question ?? '',
    notes: body.notes ?? '',
    category: body.category ?? 'General',
    agentId: body.agentId,
    createdAt: body.createdAt ?? new Date().toISOString(),
  }
  saveQuestion(q)
  return NextResponse.json(q, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteQuestion(id)
  return NextResponse.json({ ok: true })
}

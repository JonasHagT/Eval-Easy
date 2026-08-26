import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { applyColumnMap } from '@/lib/columnMap'
import { deleteEvalSet, readEvalSets, saveEvalSet } from '@/lib/evalSetStore'
import type { ColumnMap, EvalFileKind, EvalSet } from '@/lib/types'

export async function GET() {
  return NextResponse.json(readEvalSets())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const columns: string[] = body.columns ?? []
  const rawRows: Record<string, string>[] = body.rows ?? []
  const columnMap: ColumnMap = body.columnMap
  if (!columnMap?.question) {
    return NextResponse.json({ error: 'Map a Question column before saving' }, { status: 400 })
  }

  const rows = applyColumnMap(rawRows, columnMap)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No questions found after column mapping' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const set: EvalSet = {
    id: body.id ?? uuidv4(),
    name: body.name?.trim() || body.sourceFile || 'Untitled eval set',
    description: body.description ?? '',
    sourceFile: body.sourceFile ?? '',
    sourceType: (body.sourceType ?? 'manual') as EvalFileKind,
    columns,
    columnMap,
    rows,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  }
  return NextResponse.json(saveEvalSet(set), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  deleteEvalSet(id)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { readRuns, saveRun } from '@/lib/runStore'
import type { Run } from '@/lib/types'

export async function GET() {
  return NextResponse.json(readRuns())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const run: Run = {
    id: body.id ?? uuidv4(),
    name: body.name ?? 'Untitled Run',
    description: body.description ?? '',
    systemPrompt: body.systemPrompt ?? '',
    model: body.model ?? 'claude-sonnet-4-6',
    agentName: body.agentName ?? 'Agent',
    createdAt: new Date().toISOString(),
    mode: body.mode ?? 'manual',
  }
  saveRun(run)
  return NextResponse.json(run, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { readAgents, saveAgent, deleteAgent, getAgent } from '@/lib/agentStore'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const agent = getAgent(id)
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    return NextResponse.json(agent)
  }
  return NextResponse.json(readAgents())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const agent = saveAgent(body)
  return NextResponse.json(agent, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const ok = deleteAgent(id)
  if (!ok) {
    return NextResponse.json(
      { error: 'Cannot delete the last agent, or agent not found' },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import {
  createInvite,
  getInviteByToken,
  getInvitesForRun,
  touchInvite,
  isInviteValid,
  readInvites,
} from '@/lib/inviteStore'
import { getRun } from '@/lib/runStore'
import { getEvalsByRun } from '@/lib/evalStore'
import { getAgent } from '@/lib/agentStore'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const runId = req.nextUrl.searchParams.get('runId')

  if (token) {
    const invite = getInviteByToken(token)
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (!isInviteValid(invite)) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
    }
    touchInvite(token)
    const run = getRun(invite.runId)
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    const evals = getEvalsByRun(invite.runId)
    const agent = invite.agentId ? getAgent(invite.agentId) : undefined
    return NextResponse.json({ invite, run, evals, agent })
  }

  if (runId) {
    return NextResponse.json(getInvitesForRun(runId))
  }

  return NextResponse.json(readInvites())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 })
  }
  const run = getRun(body.runId)
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const invite = createInvite({
    runId: body.runId,
    agentId: body.agentId ?? run.agentId,
    label: body.label ?? `Review: ${run.name}`,
    suggestedName: body.suggestedName,
    expiresAt: body.expiresAt,
  })

  return NextResponse.json(invite, { status: 201 })
}

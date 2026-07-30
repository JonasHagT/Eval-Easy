import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { Invite } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'invites.json')

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readInvites(): Invite[] {
  ensure()
  if (!fs.existsSync(FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeAll(invites: Invite[]) {
  ensure()
  fs.writeFileSync(FILE, JSON.stringify(invites, null, 2))
}

export function createInvite(input: {
  runId: string
  agentId?: string
  label?: string
  suggestedName?: string
  expiresAt?: string
}): Invite {
  const invite: Invite = {
    id: uuidv4(),
    token: randomBytes(12).toString('base64url'),
    runId: input.runId,
    agentId: input.agentId,
    label: input.label ?? 'Review invite',
    suggestedName: input.suggestedName,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    openCount: 0,
  }
  const invites = readInvites()
  invites.push(invite)
  writeAll(invites)
  return invite
}

export function getInviteByToken(token: string): Invite | undefined {
  return readInvites().find(i => i.token === token)
}

export function touchInvite(token: string): Invite | undefined {
  const invites = readInvites()
  const i = invites.findIndex(inv => inv.token === token)
  if (i < 0) return undefined
  invites[i] = { ...invites[i], openCount: invites[i].openCount + 1 }
  writeAll(invites)
  return invites[i]
}

export function getInvitesForRun(runId: string): Invite[] {
  return readInvites().filter(i => i.runId === runId)
}

export function isInviteValid(invite: Invite): boolean {
  if (!invite.expiresAt) return true
  return new Date(invite.expiresAt).getTime() > Date.now()
}

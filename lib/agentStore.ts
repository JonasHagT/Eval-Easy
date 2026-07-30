import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Agent, DEFAULT_EMAIL_AGENT } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'agents.json')

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function seedIfEmpty(agents: Agent[]): Agent[] {
  if (agents.length > 0) return agents
  const now = new Date().toISOString()
  const seeded: Agent = {
    ...DEFAULT_EMAIL_AGENT,
    id: 'agent-email-default',
    createdAt: now,
    updatedAt: now,
  }
  fs.writeFileSync(FILE, JSON.stringify([seeded], null, 2))
  return [seeded]
}

export function readAgents(): Agent[] {
  ensure()
  if (!fs.existsSync(FILE)) {
    return seedIfEmpty([])
  }
  try {
    const agents = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Agent[]
    return seedIfEmpty(agents)
  } catch {
    return seedIfEmpty([])
  }
}

export function getAgent(id: string): Agent | undefined {
  return readAgents().find(a => a.id === id)
}

export function saveAgent(input: Partial<Agent> & { name: string }): Agent {
  ensure()
  const agents = readAgents()
  const now = new Date().toISOString()
  const existing = input.id ? agents.find(a => a.id === input.id) : undefined

  const agent: Agent = {
    id: existing?.id ?? input.id ?? uuidv4(),
    name: input.name,
    description: input.description ?? existing?.description ?? '',
    instructions: input.instructions ?? existing?.instructions ?? DEFAULT_EMAIL_AGENT.instructions,
    model: input.model ?? existing?.model ?? DEFAULT_EMAIL_AGENT.model,
    scoreGuide: input.scoreGuide ?? existing?.scoreGuide ?? DEFAULT_EMAIL_AGENT.scoreGuide,
    connection: input.connection ?? existing?.connection ?? 'claude',
    apiUrl: input.apiUrl ?? existing?.apiUrl,
    apiHeaders: input.apiHeaders ?? existing?.apiHeaders,
    passThreshold: input.passThreshold ?? existing?.passThreshold ?? 3,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const i = agents.findIndex(a => a.id === agent.id)
  if (i >= 0) agents[i] = agent
  else agents.push(agent)

  fs.writeFileSync(FILE, JSON.stringify(agents, null, 2))
  return agent
}

export function deleteAgent(id: string): boolean {
  ensure()
  const agents = readAgents()
  if (agents.length <= 1) return false
  const next = agents.filter(a => a.id !== id)
  if (next.length === agents.length) return false
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2))
  return true
}

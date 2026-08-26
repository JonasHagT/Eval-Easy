const API_BASE = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_BETA = 'managed-agents-2026-04-01'

const IDLE_POLL_MS = 2000
const MAX_WAIT_MS = 4 * 60 * 1000

type Json = Record<string, unknown>

export type ConsoleAgentInfo = {
  source: 'claude-console'
  name: string
  description: string
  systemPrompt: string
  model: string
  deploymentId: string
  deploymentName: string
  agentId: string
}

type Deployment = {
  id: string
  name: string
  environment_id: string
  vault_ids?: string[]
  agent: { id: string; type: string; version: number }
}

type AgentRecord = {
  id: string
  name: string
  description?: string | null
  system?: string | null
  model?: { id?: string } | string | null
}

type SessionRecord = {
  id: string
  status: string
}

type SessionEvent = {
  id?: string
  type: string
  content?: Array<{ type?: string; text?: string }>
  stop_reason?: { type?: string }
}

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return key
}

function headers(json = true): HeadersInit {
  const h: Record<string, string> = {
    'x-api-key': apiKey(),
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-beta': ANTHROPIC_BETA,
  }
  if (json) h['content-type'] = 'application/json'
  return h
}

function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string }
    return parsed.error?.message || parsed.message || body.slice(0, 400)
  } catch {
    return body.slice(0, 400) || `HTTP ${status}`
  }
}

async function anthropicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...headers(init.body !== undefined), ...(init.headers as Record<string, string> | undefined) },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(errorMessage(res.status, text))
  }
  return (text ? JSON.parse(text) : {}) as T
}

function modelId(model: AgentRecord['model']): string {
  if (!model) return 'claude-opus-5'
  if (typeof model === 'string') return model
  return model.id ?? 'claude-opus-5'
}

export function isConsoleAgentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_DEPLOYMENT_ID || process.env.ANTHROPIC_AGENT_ID)
}

export async function getConsoleAgentInfo(): Promise<ConsoleAgentInfo> {
  const deployment = await getDeployment()
  const agent = await anthropicFetch<AgentRecord>(`/agents/${deployment.agent.id}?beta=true`)
  return {
    source: 'claude-console',
    name: agent.name,
    description: agent.description ?? '',
    systemPrompt: agent.system ?? '',
    model: modelId(agent.model),
    deploymentId: deployment.id,
    deploymentName: deployment.name,
    agentId: agent.id,
  }
}

async function getDeployment(): Promise<Deployment> {
  const deploymentId = process.env.ANTHROPIC_DEPLOYMENT_ID
  if (deploymentId) {
    return anthropicFetch<Deployment>(`/deployments/${deploymentId}?beta=true`)
  }

  const agentId = process.env.ANTHROPIC_AGENT_ID
  const environmentId = process.env.ANTHROPIC_ENVIRONMENT_ID
  if (!agentId || !environmentId) {
    throw new Error('Set ANTHROPIC_DEPLOYMENT_ID (or ANTHROPIC_AGENT_ID and ANTHROPIC_ENVIRONMENT_ID)')
  }

  return {
    id: '',
    name: 'Claude Console agent',
    environment_id: environmentId,
    vault_ids: (process.env.ANTHROPIC_VAULT_IDS ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    agent: { id: agentId, type: 'agent', version: 0 },
  }
}

export async function createConsoleSession(title = 'Eval Easy'): Promise<string> {
  const deployment = await getDeployment()
  const body: Json = {
    agent: deployment.agent.version
      ? { type: 'agent', id: deployment.agent.id, version: deployment.agent.version }
      : deployment.agent.id,
    environment_id: deployment.environment_id,
    title,
  }
  if (deployment.vault_ids?.length) body.vault_ids = deployment.vault_ids

  const session = await anthropicFetch<SessionRecord>('/sessions?beta=true', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return session.id
}

async function sendUserMessage(sessionId: string, text: string): Promise<void> {
  await anthropicFetch(`/sessions/${sessionId}/events?beta=true`, {
    method: 'POST',
    body: JSON.stringify({
      events: [
        {
          type: 'user.message',
          content: [{ type: 'text', text }],
        },
      ],
    }),
  })
}

async function listEvents(sessionId: string): Promise<SessionEvent[]> {
  const data = await anthropicFetch<{ data?: SessionEvent[] }>(
    `/sessions/${sessionId}/events?beta=true`
  )
  return data.data ?? []
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForTurn(sessionId: string, userText: string): Promise<SessionEvent[]> {
  const deadline = Date.now() + MAX_WAIT_MS
  let delay = IDLE_POLL_MS

  while (Date.now() < deadline) {
    const events = await listEvents(sessionId)
    let lastUser = -1
    for (let i = 0; i < events.length; i++) {
      if (events[i].type === 'user.message') lastUser = i
    }

    if (lastUser >= 0) {
      const lastUserText = (events[lastUser].content ?? [])
        .filter(block => block.type === 'text' && block.text)
        .map(block => block.text as string)
        .join('\n')
        .trim()

      if (lastUserText === userText.trim()) {
        const rest = events.slice(lastUser + 1)
        const idle = rest.find(event => event.type === 'session.status_idle')
        if (idle) {
          if (idle.stop_reason?.type === 'requires_action') {
            throw new Error('Console agent paused and needs an action before it can finish')
          }
          return events
        }
      }
    }

    await sleep(delay)
    delay = Math.min(Math.round(delay * 1.15), 5000)
  }

  throw new Error('Console agent timed out waiting for a response')
}

function lastTurnAgentText(events: SessionEvent[]): string {
  let lastUser = -1
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === 'user.message') lastUser = i
  }

  const texts: string[] = []
  const start = lastUser >= 0 ? lastUser + 1 : 0
  for (let i = start; i < events.length; i++) {
    const event = events[i]
    if (event.type !== 'agent.message') continue
    const chunk = (event.content ?? [])
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text as string)
      .join('\n')
      .trim()
    if (chunk) texts.push(chunk)
  }

  if (texts.length === 0) {
    throw new Error('Console agent finished without a text response')
  }

  return texts[texts.length - 1]
}

export async function runConsoleTurn(opts: {
  userMessage: string
  sessionId?: string | null
  title?: string
}): Promise<{ sessionId: string; response: string }> {
  const sessionId = opts.sessionId || (await createConsoleSession(opts.title ?? 'Eval Easy'))
  await sendUserMessage(sessionId, opts.userMessage)
  const events = await waitForTurn(sessionId, opts.userMessage)
  return { sessionId, response: lastTurnAgentText(events) }
}

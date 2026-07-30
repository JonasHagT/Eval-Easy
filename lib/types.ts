export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AutoGrade {
  score: 1 | 2 | 3 | 4 | 5
  verdict: 'pass' | 'fail'
  reasoning: string
}

export interface TestQuestion {
  id: string
  question: string
  notes: string
  category: string
  agentId?: string
  createdAt: string
}

export interface Run {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  agentName: string
  agentId?: string
  createdAt: string
  mode: 'manual' | 'batch'
  parentRunId?: string
}

export type ReviewStatus = 'pending_review' | 'reviewed' | 'skipped'

export interface EvalEntry {
  id: string
  sessionId: string
  runId?: string
  runName?: string
  turnIndex: number
  userMessage: string
  agentResponse: string
  rating: 1 | 2 | 3 | 4 | 5 | null
  thumbs: 'up' | 'down' | null
  tags: string[]
  comment: string
  agentName: string
  agentId?: string
  systemPrompt: string
  model: string
  createdAt: string
  questionId?: string
  autoGrade?: AutoGrade
  reviewStatus?: ReviewStatus
  reviewedBy?: string
  reviewedAt?: string
  /** True when a human overrode the AI auto-grade */
  humanOverride?: boolean
}

export type AgentConnection = 'claude' | 'api'

export interface Agent {
  id: string
  name: string
  /** Plain-language label shown to specialists */
  description: string
  /** Instructions sent to the model (formerly "system prompt") */
  instructions: string
  model: string
  /** Shared scoring guide for this agent */
  scoreGuide: string
  connection: AgentConnection
  /** External agent endpoint (POST JSON { messages, instructions }) */
  apiUrl?: string
  apiHeaders?: Record<string, string>
  /** Minimum score (1–5) that counts as a pass */
  passThreshold: number
  createdAt: string
  updatedAt: string
}

/** @deprecated Prefer Agent — kept for localStorage migration */
export interface AgentConfig {
  name: string
  systemPrompt: string
  model: string
  annotationGuide: string
}

export interface Invite {
  id: string
  token: string
  runId: string
  agentId?: string
  label: string
  /** Optional suggested reviewer name */
  suggestedName?: string
  createdAt: string
  expiresAt?: string
  /** How many times the invite link was opened */
  openCount: number
}

export const EMAIL_TAGS: { label: string; sentiment: 'negative' | 'warning' | 'positive' }[] = [
  { label: 'Wrong info', sentiment: 'negative' },
  { label: 'Off-topic', sentiment: 'negative' },
  { label: 'Weak subject', sentiment: 'warning' },
  { label: 'Too salesy', sentiment: 'warning' },
  { label: 'Missing CTA', sentiment: 'warning' },
  { label: 'Too long', sentiment: 'warning' },
  { label: 'Too short', sentiment: 'warning' },
  { label: 'Tone off', sentiment: 'warning' },
  { label: 'Placeholders left', sentiment: 'warning' },
  { label: 'Wrong audience', sentiment: 'warning' },
  { label: 'Great answer', sentiment: 'positive' },
  { label: 'Helpful', sentiment: 'positive' },
]

export const DEFAULT_EMAIL_AGENT: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Email Assistant',
  description: 'Writes clear, professional emails for common business situations.',
  instructions:
    'You are a professional email writing assistant. Help users craft clear, effective, and persuasive emails for any situation.',
  model: 'claude-sonnet-4-6',
  scoreGuide:
    'A good email is clear, appropriately toned, has a useful subject line, includes a concrete next step, and avoids fluff or leftover placeholders.',
  connection: 'claude',
  passThreshold: 3,
}

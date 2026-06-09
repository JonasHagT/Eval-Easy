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
  createdAt: string
}

export interface Run {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  agentName: string
  createdAt: string
  mode: 'manual' | 'batch'
}

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
  systemPrompt: string
  model: string
  createdAt: string
  questionId?: string
  autoGrade?: AutoGrade
}

export interface AgentConfig {
  name: string
  systemPrompt: string
  model: string
  annotationGuide: string
}

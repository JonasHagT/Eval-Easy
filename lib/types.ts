export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface EvalEntry {
  id: string
  sessionId: string
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
}

export interface AgentConfig {
  name: string
  systemPrompt: string
  model: string
}

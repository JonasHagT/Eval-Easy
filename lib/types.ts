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

export type EvalFileKind = 'csv' | 'xlsx' | 'xls' | 'docx' | 'pptx' | 'pdf' | 'manual'

export interface ColumnMap {
  question: string
  expected: string | null
  notes: string | null
  category: string | null
  id: string | null
}

export interface EvalSetRow {
  id: string
  question: string
  expected: string
  notes: string
  category: string
  raw: Record<string, string>
}

export interface EvalSet {
  id: string
  name: string
  description: string
  sourceFile: string
  sourceType: EvalFileKind
  columns: string[]
  columnMap: ColumnMap
  rows: EvalSetRow[]
  createdAt: string
  updatedAt: string
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
  evalSetId?: string
  evalSetName?: string
  agentSource?: 'messages' | 'claude-console'
  deploymentId?: string
  deploymentName?: string
  rowCount?: number
  sourceFile?: string
}

export interface EvalEntry {
  id: string
  sessionId: string
  runId?: string
  runName?: string
  turnIndex: number
  userMessage: string
  agentResponse: string
  expectedAnswer?: string
  rating: 1 | 2 | 3 | 4 | 5 | null
  thumbs: 'up' | 'down' | null
  tags: string[]
  comment: string
  agentName: string
  systemPrompt: string
  model: string
  createdAt: string
  questionId?: string
  evalSetId?: string
  evalSetName?: string
  autoGrade?: AutoGrade
}

export interface AgentConfig {
  name: string
  systemPrompt: string
  model: string
  annotationGuide: string
  source?: 'messages' | 'claude-console'
  deploymentName?: string
}

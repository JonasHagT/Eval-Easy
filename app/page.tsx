'use client'

import { useState, useRef, useEffect } from 'react'
import ChatPanel from '@/components/ChatPanel'
import EvalPanel from '@/components/EvalPanel'
import AgentLibraryModal from '@/components/AgentLibraryModal'
import { Message, Agent, EvalEntry, DEFAULT_EMAIL_AGENT } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

const ACTIVE_KEY = 'evalEasy_activeAgentId'

export default function Home() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [showAgents, setShowAgents] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId] = useState(() => uuidv4())
  const [isLoading, setIsLoading] = useState(false)
  const [pendingEval, setPendingEval] = useState<{
    turnIndex: number
    userMessage: string
    agentResponse: string
  } | null>(null)
  const [evalCount, setEvalCount] = useState(0)
  const turnIndexRef = useRef(0)

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then((agents: Agent[]) => {
        const storedId = localStorage.getItem(ACTIVE_KEY)
        const found = agents.find(a => a.id === storedId) ?? agents[0]
        if (found) {
          setAgent(found)
          localStorage.setItem(ACTIVE_KEY, found.id)
        } else {
          // Seed via API if empty somehow
          fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(DEFAULT_EMAIL_AGENT),
          })
            .then(r => r.json())
            .then((a: Agent) => {
              setAgent(a)
              localStorage.setItem(ACTIVE_KEY, a.id)
            })
        }
      })
  }, [])

  const selectAgent = (a: Agent) => {
    setAgent(a)
    localStorage.setItem(ACTIVE_KEY, a.id)
    setMessages([])
    setPendingEval(null)
    turnIndexRef.current = 0
  }

  const sendMessage = async (content: string) => {
    if (!agent) return
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsLoading(true)
    setPendingEval(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          agentId: agent.id,
          instructions: agent.instructions,
          model: agent.model,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
      turnIndexRef.current += 1
      setPendingEval({
        turnIndex: turnIndexRef.current,
        userMessage: content,
        agentResponse: data.response,
      })
    } catch (err) {
      const errorMsg: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to reach agent.'}`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveEval = async (
    evalData: Omit<
      EvalEntry,
      'id' | 'createdAt' | 'sessionId' | 'agentName' | 'systemPrompt' | 'runId' | 'runName'
    >
  ) => {
    if (!agent) return
    await fetch('/api/evals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...evalData,
        sessionId,
        agentName: agent.name,
        agentId: agent.id,
        systemPrompt: agent.instructions,
        reviewStatus: 'reviewed',
        reviewedBy: 'Manual tester',
        reviewedAt: new Date().toISOString(),
      }),
    })
    setEvalCount(prev => prev + 1)
    setPendingEval(null)
  }

  const modelLabel = agent
    ? agent.connection === 'api'
      ? 'External API'
      : agent.model.replace('claude-', '').replace('-20251001', '')
    : '…'

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-white">Eval Easy</span>
          <span className="text-xs bg-indigo-600/80 text-indigo-100 px-2 py-0.5 rounded-full font-medium">
            beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="text-gray-400 font-medium">{agent?.name ?? 'Loading…'}</span>
            <span className="text-gray-700">·</span>
            <span>{modelLabel}</span>
          </div>
          <a
            href="/test-suite"
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Test Bank
          </a>
          <a
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Dashboard
          </a>
          <button
            onClick={() => setShowAgents(true)}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Agents
          </button>
          {evalCount > 0 && (
            <a
              href="/api/evals/export"
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 hover:border-indigo-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Export CSV
            </a>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          hasPendingEval={pendingEval !== null}
        />
        {agent && (
          <EvalPanel
            pendingEval={pendingEval}
            agent={agent}
            onSave={handleSaveEval}
            onSkip={() => setPendingEval(null)}
          />
        )}
      </div>

      {showAgents && (
        <AgentLibraryModal
          activeAgentId={agent?.id}
          onSelect={selectAgent}
          onClose={() => setShowAgents(false)}
        />
      )}
    </div>
  )
}

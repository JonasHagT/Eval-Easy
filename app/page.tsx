'use client'

import { useState, useRef, useEffect } from 'react'
import ChatPanel from '@/components/ChatPanel'
import EvalPanel from '@/components/EvalPanel'
import AgentConfigModal from '@/components/AgentConfigModal'
import { Message, AgentConfig, EvalEntry } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

const DEFAULT_CONFIG: AgentConfig = {
  name: 'Email Assistant',
  systemPrompt:
    'You are a professional email writing assistant. Help users craft clear, effective, and persuasive emails for any situation.',
  model: 'claude-sonnet-4-6',
  annotationGuide: '',
}

const STORAGE_KEY = 'evalEasy_agentConfig'

export default function Home() {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)
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

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setConfig({ ...DEFAULT_CONFIG, ...parsed })
      } catch { /* ignore */ }
    }
  }, [])

  // Persist config changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }, [config])

  const sendMessage = async (content: string) => {
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
          systemPrompt: config.systemPrompt,
          model: config.model,
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
        content: `Error: ${err instanceof Error ? err.message : 'Failed to reach agent. Check your API key.'}`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveEval = async (
    evalData: Omit<EvalEntry, 'id' | 'createdAt' | 'sessionId' | 'agentName' | 'systemPrompt' | 'runId' | 'runName'>
  ) => {
    await fetch('/api/evals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...evalData,
        sessionId,
        agentName: config.name,
        systemPrompt: config.systemPrompt,
      }),
    })
    setEvalCount(prev => prev + 1)
    setPendingEval(null)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-white">Eval Easy</span>
          <span className="text-xs bg-indigo-600/80 text-indigo-100 px-2 py-0.5 rounded-full font-medium">beta</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="text-gray-400 font-medium">{config.name}</span>
            <span className="text-gray-700">·</span>
            <span>{config.model.replace('claude-', '').replace('-20251001', '')}</span>
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
            onClick={() => setShowConfig(true)}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Configure Agent
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

      {/* Main split */}
      <div className="flex flex-1 min-h-0">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          hasPendingEval={pendingEval !== null}
        />
        <EvalPanel
          pendingEval={pendingEval}
          config={config}
          onSave={handleSaveEval}
          onSkip={() => setPendingEval(null)}
        />
      </div>

      {showConfig && (
        <AgentConfigModal
          config={config}
          onSave={newConfig => {
            setConfig(newConfig)
            setShowConfig(false)
          }}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isConsoleAgentConfigured, runConsoleTurn } from '@/lib/managedAgent'

export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model, sessionId } = await req.json()

    const lastUser = [...(messages ?? [])]
      .reverse()
      .find((m: { role?: string; content?: string }) => m.role === 'user' && m.content)

    if (isConsoleAgentConfigured()) {
      if (!lastUser?.content) {
        return NextResponse.json({ error: 'A user message is required' }, { status: 400 })
      }

      const result = await runConsoleTurn({
        userMessage: lastUser.content,
        sessionId: typeof sessionId === 'string' && sessionId ? sessionId : null,
      })

      return NextResponse.json({
        response: result.response,
        sessionId: result.sessionId,
        source: 'claude-console',
      })
    }

    const response = await anthropic.messages.create({
      model: model ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt ?? 'You are a helpful assistant.',
      messages: (messages ?? []).map((m: { role: 'user' | 'assistant'; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ response: text, source: 'messages' })
  } catch (err) {
    console.error('Agent API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent call failed' },
      { status: 500 }
    )
  }
}

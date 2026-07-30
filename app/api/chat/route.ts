import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agentRunner'
import { getAgent, readAgents } from '@/lib/agentStore'

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model, agentId, instructions } = await req.json()

    const agent =
      (agentId && getAgent(agentId)) ||
      readAgents()[0] || {
        name: 'Agent',
        connection: 'claude' as const,
        instructions: systemPrompt ?? instructions ?? 'You are a helpful assistant.',
        model: model ?? 'claude-sonnet-4-6',
      }

    const text = await runAgent({
      agent: {
        ...agent,
        instructions: instructions ?? systemPrompt ?? agent.instructions,
        model: model ?? agent.model,
      },
      messages,
      modelOverride: model,
    })

    return NextResponse.json({ response: text })
  } catch (err) {
    console.error('Agent call error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent call failed' },
      { status: 500 }
    )
  }
}

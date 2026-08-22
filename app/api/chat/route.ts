import { NextRequest, NextResponse } from 'next/server'
import { runBudgetAgent } from '@/lib/budgetAgent'

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model } = await req.json()

    const result = await runBudgetAgent({
      messages,
      systemPrompt: systemPrompt ?? 'You are a helpful assistant.',
      model: model ?? 'claude-sonnet-4-6',
    })

    return NextResponse.json({
      response: result.text,
      toolCalls: result.toolCalls,
      usedMcp: result.usedMcp,
    })
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent call failed' },
      { status: 500 }
    )
  }
}

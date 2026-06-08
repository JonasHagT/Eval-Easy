import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model } = await req.json()

    const response = await anthropic.messages.create({
      model: model ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt ?? 'You are a helpful assistant.',
      messages: messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ response: text })
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent call failed' },
      { status: 500 }
    )
  }
}

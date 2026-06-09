import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { question, response: agentResponse, annotationGuide } = await req.json()

    const userPrompt = `You are grading an AI agent response. Return ONLY valid JSON.

Question: ${question}

Response: ${agentResponse}
${annotationGuide ? `\nEvaluation criteria:\n${annotationGuide}` : ''}

Return this exact JSON (no markdown, no explanation):
{"score":1-5,"verdict":"pass or fail","reasoning":"one sentence"}`

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    const score = Math.min(5, Math.max(1, Math.round(Number(parsed.score)))) as 1 | 2 | 3 | 4 | 5

    return NextResponse.json({
      score,
      verdict: (score >= 3 ? 'pass' : 'fail') as 'pass' | 'fail',
      reasoning: String(parsed.reasoning ?? ''),
    })
  } catch (err) {
    console.error('Autograde error:', err)
    return NextResponse.json({
      score: 3 as const,
      verdict: 'pass' as const,
      reasoning: 'Could not auto-grade — please review manually.',
    })
  }
}

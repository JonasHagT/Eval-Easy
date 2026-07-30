import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getRun, saveRun, readRuns } from '@/lib/runStore'
import { getEvalsByRun, saveEval } from '@/lib/evalStore'
import { getAgent, readAgents } from '@/lib/agentStore'
import { readQuestions } from '@/lib/testStore'
import { runAgent } from '@/lib/agentRunner'
import type { Run, EvalEntry, AutoGrade } from '@/lib/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET() {
  return NextResponse.json(readRuns())
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // One-click re-run of an existing run
  if (body.rerunOf) {
    return handleRerun(body)
  }

  const agents = readAgents()
  const agent =
    (body.agentId && getAgent(body.agentId)) ||
    agents.find(a => a.name === body.agentName) ||
    agents[0]

  const run: Run = {
    id: body.id ?? uuidv4(),
    name: body.name ?? 'Untitled Run',
    description: body.description ?? '',
    systemPrompt: body.systemPrompt ?? agent?.instructions ?? '',
    model: body.model ?? agent?.model ?? 'claude-sonnet-4-6',
    agentName: body.agentName ?? agent?.name ?? 'Agent',
    agentId: body.agentId ?? agent?.id,
    createdAt: new Date().toISOString(),
    mode: body.mode ?? 'manual',
    parentRunId: body.parentRunId,
  }
  saveRun(run)
  return NextResponse.json(run, { status: 201 })
}

async function handleRerun(body: {
  rerunOf: string
  name?: string
  description?: string
  model?: string
  failedOnly?: boolean
  agentId?: string
}) {
  const parent = getRun(body.rerunOf)
  if (!parent) {
    return NextResponse.json({ error: 'Parent run not found' }, { status: 404 })
  }

  const agent =
    (body.agentId && getAgent(body.agentId)) ||
    (parent.agentId && getAgent(parent.agentId)) ||
    readAgents()[0]

  if (!agent) {
    return NextResponse.json({ error: 'No agent configured' }, { status: 400 })
  }

  const parentEvals = getEvalsByRun(parent.id)
  let questions = readQuestions(agent.id)

  // Prefer reusing the exact questions from the parent run
  const fromParent = parentEvals
    .filter(e => !body.failedOnly || e.thumbs === 'down' || e.autoGrade?.verdict === 'fail')
    .map(e => ({
      id: e.questionId ?? e.id,
      question: e.userMessage,
      notes: '',
    }))

  if (fromParent.length > 0) {
    // Use parent questions; attach notes from test bank when available
    const noteMap = new Map(questions.map(q => [q.id, q.notes]))
    const qMap = new Map(questions.map(q => [q.question, q]))
    questions = fromParent.map(p => {
      const match = qMap.get(p.question)
      return {
        id: p.id,
        question: p.question,
        notes: match ? match.notes : (noteMap.get(p.id) ?? ''),
        category: match?.category ?? 'General',
        agentId: agent.id,
        createdAt: match?.createdAt ?? new Date().toISOString(),
      }
    })
  } else if (questions.length === 0) {
    return NextResponse.json({ error: 'No questions to re-run' }, { status: 400 })
  }

  const model = body.model ?? parent.model
  const run: Run = {
    id: uuidv4(),
    name: body.name ?? `Re-run of ${parent.name}`,
    description:
      body.description ??
      (body.failedOnly ? `Retry failed from ${parent.name}` : `Re-run of ${parent.name}`),
    systemPrompt: agent.instructions,
    model,
    agentName: agent.name,
    agentId: agent.id,
    createdAt: new Date().toISOString(),
    mode: 'batch',
    parentRunId: parent.id,
  }
  saveRun(run)

  const results: EvalEntry[] = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    let agentResponse = ''
    try {
      agentResponse = await runAgent({
        agent,
        messages: [{ role: 'user', content: q.question }],
        modelOverride: model,
      })
    } catch (err) {
      agentResponse = `Error: ${err instanceof Error ? err.message : 'could not reach agent.'}`
    }

    const guide = q.notes || agent.scoreGuide
    const autoGrade = await autoGradeResponse(q.question, agentResponse, guide, agent.passThreshold)

    const entry: EvalEntry = {
      id: uuidv4(),
      sessionId: run.id,
      runId: run.id,
      runName: run.name,
      turnIndex: i + 1,
      userMessage: q.question,
      agentResponse,
      thumbs: autoGrade.verdict === 'pass' ? 'up' : 'down',
      rating: autoGrade.score,
      tags: [],
      comment: '',
      agentName: agent.name,
      agentId: agent.id,
      systemPrompt: agent.instructions,
      model,
      createdAt: new Date().toISOString(),
      questionId: q.id,
      autoGrade,
      reviewStatus: 'pending_review',
    }
    saveEval(entry)
    results.push(entry)
  }

  return NextResponse.json({ run, results }, { status: 201 })
}

async function autoGradeResponse(
  question: string,
  agentResponse: string,
  annotationGuide: string,
  passThreshold: number
): Promise<AutoGrade> {
  try {
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
    if (!jsonMatch) throw new Error('No JSON')
    const parsed = JSON.parse(jsonMatch[0])
    const score = Math.min(5, Math.max(1, Math.round(Number(parsed.score)))) as 1 | 2 | 3 | 4 | 5
    return {
      score,
      verdict: score >= passThreshold ? 'pass' : 'fail',
      reasoning: String(parsed.reasoning ?? ''),
    }
  } catch {
    return {
      score: 3,
      verdict: 3 >= passThreshold ? 'pass' : 'fail',
      reasoning: 'Could not auto-grade — please review manually.',
    }
  }
}

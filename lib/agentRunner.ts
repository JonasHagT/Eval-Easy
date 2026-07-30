import Anthropic from '@anthropic-ai/sdk'
import { Agent } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runAgent(opts: {
  agent: Pick<Agent, 'connection' | 'instructions' | 'model' | 'apiUrl' | 'apiHeaders' | 'name'>
  messages: { role: 'user' | 'assistant'; content: string }[]
  modelOverride?: string
}): Promise<string> {
  const { agent, messages, modelOverride } = opts

  if (agent.connection === 'api') {
    if (!agent.apiUrl) throw new Error('This agent has no API URL configured.')
    const res = await fetch(agent.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(agent.apiHeaders ?? {}),
      },
      body: JSON.stringify({
        messages,
        instructions: agent.instructions,
        systemPrompt: agent.instructions,
        model: modelOverride ?? agent.model,
        agentName: agent.name,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Agent API error (${res.status}): ${text || res.statusText}`)
    }
    const data = await res.json()
    const text =
      data.response ?? data.content ?? data.message ?? data.text ?? data.output ?? ''
    if (!text) throw new Error('Agent API returned no response text.')
    return typeof text === 'string' ? text : JSON.stringify(text)
  }

  const response = await anthropic.messages.create({
    model: modelOverride ?? agent.model ?? 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: agent.instructions || 'You are a helpful assistant.',
    messages,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

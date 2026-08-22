import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const SKILL_PATH = path.join(process.cwd(), 'skills', 'budget-pacing', 'SKILL.md')
const MCP_SERVER_PATH = path.join(process.cwd(), 'mcp', 'budget-pacing-server.mjs')
const MAX_STEPS = 6

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolCallTrace {
  name: string
  input: unknown
  result: string
}

export interface AgentResult {
  text: string
  toolCalls: ToolCallTrace[]
  usedMcp: boolean
}

/**
 * Minimal shape of the Anthropic client this agent needs. Allows injecting a
 * stand-in during offline tests without a live API key.
 */
export interface AnthropicLike {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming
    ): Promise<Anthropic.Message>
  }
}

function loadSkill(): string {
  try {
    return fs.readFileSync(SKILL_PATH, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Build the effective system prompt: the caller's agent prompt plus the
 * budget-pacing skill (SOP) so the agent knows the methodology and tools.
 */
function buildSystem(systemPrompt: string): string {
  const skill = loadSkill()
  if (!skill) return systemPrompt
  return `${systemPrompt}\n\n---\n# Loaded skill\n${skill}`
}

async function openMcpClient(): Promise<Client | null> {
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_SERVER_PATH],
      cwd: process.cwd(),
    })
    const client = new Client({ name: 'eval-easy', version: '0.1.0' }, { capabilities: {} })
    await client.connect(transport)
    return client
  } catch (err) {
    console.error('Could not start budget-pacing MCP server:', err)
    return null
  }
}

function toolResultText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map(block =>
        block && typeof block === 'object' && 'text' in block
          ? String((block as { text: unknown }).text)
          : JSON.stringify(block)
      )
      .join('\n')
  }
  return typeof content === 'string' ? content : JSON.stringify(content)
}

/**
 * Run the budget-pacing agent: Claude + the budget-pacing MCP tools + skill.
 * Falls back to a plain (tool-less) completion if the MCP server can't start.
 */
export async function runBudgetAgent(
  params: {
    messages: ChatMessage[]
    systemPrompt: string
    model: string
  },
  deps?: { anthropic?: AnthropicLike }
): Promise<AgentResult> {
  const anthropic: AnthropicLike =
    deps?.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const system = buildSystem(params.systemPrompt)

  const client = await openMcpClient()
  let tools: Anthropic.Tool[] = []
  if (client) {
    const listed = await client.listTools()
    tools = listed.tools.map(t => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }))
  }

  const messages: Anthropic.MessageParam[] = params.messages.map(m => ({
    role: m.role,
    content: m.content,
  }))
  const toolCalls: ToolCallTrace[] = []

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await anthropic.messages.create({
        model: params.model,
        max_tokens: 4096,
        system,
        messages,
        ...(tools.length > 0 ? { tools } : {}),
      })

      if (response.stop_reason === 'tool_use' && client) {
        const toolUses = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const use of toolUses) {
          let resultText: string
          let isError = false
          try {
            const res = await client.callTool({
              name: use.name,
              arguments: (use.input ?? {}) as Record<string, unknown>,
            })
            resultText = toolResultText(res.content)
            isError = res.isError === true
          } catch (err) {
            resultText = `Tool call failed: ${err instanceof Error ? err.message : String(err)}`
            isError = true
          }
          toolCalls.push({ name: use.name, input: use.input, result: resultText })
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: resultText,
            is_error: isError,
          })
        }
        messages.push({ role: 'assistant', content: response.content })
        messages.push({ role: 'user', content: results })
        continue
      }

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim()
      return { text, toolCalls, usedMcp: tools.length > 0 }
    }

    return {
      text: 'Reached the maximum number of tool-use steps without a final answer.',
      toolCalls,
      usedMcp: tools.length > 0,
    }
  } finally {
    if (client) {
      await client.close().catch(() => {})
    }
  }
}

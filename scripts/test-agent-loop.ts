/**
 * Offline end-to-end test of the budget-pacing agent loop.
 *
 * We cannot call the real Claude API without a key, so we inject a scripted
 * stand-in for the Anthropic client. The stand-in plays Claude's role:
 *   turn 1 -> request the `get_account_summary` tool
 *   turn 2 -> read the REAL tool result (produced by the real MCP server) and
 *             emit a final answer that quotes it.
 *
 * This exercises the full orchestration: tools are advertised to the model,
 * the model's tool_use is executed against the live MCP server, the result is
 * threaded back as a tool_result, and a final text answer is produced.
 *
 * Run: npx tsx scripts/test-agent-loop.ts
 */
import type Anthropic from '@anthropic-ai/sdk'
import { runBudgetAgent, type AnthropicLike } from '../lib/budgetAgent'

let call = 0
const seenToolNames: string[] = []
let toolResultSeen = ''

const fakeAnthropic: AnthropicLike = {
  messages: {
    async create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
      call++
      for (const t of body.tools ?? []) seenToolNames.push(t.name)

      if (call === 1) {
        return {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: body.model,
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 } as Anthropic.Usage,
          content: [
            { type: 'text', text: 'Let me check the account pacing.' },
            { type: 'tool_use', id: 'tu_1', name: 'get_account_summary', input: {} },
          ],
        } as Anthropic.Message
      }

      // Second call: the last user message carries the tool_result from MCP.
      const last = body.messages[body.messages.length - 1]
      const blocks = Array.isArray(last.content) ? last.content : []
      for (const b of blocks) {
        if (b.type === 'tool_result') {
          toolResultSeen = typeof b.content === 'string' ? b.content : JSON.stringify(b.content)
        }
      }
      const idx = toolResultSeen.indexOf('accountPacingIndex')
      const snippet = idx >= 0 ? toolResultSeen.slice(idx, idx + 30) : '(missing)'
      return {
        id: 'msg_2',
        type: 'message',
        role: 'assistant',
        model: body.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 } as Anthropic.Usage,
        content: [
          {
            type: 'text',
            text: `Based on the live account data, the account is marginally over pace (${snippet}).`,
          },
        ],
      } as Anthropic.Message
    },
  },
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('ok  -', msg)
}

async function main() {
  const result = await runBudgetAgent(
    {
      messages: [{ role: 'user', content: 'How is the account pacing overall?' }],
      systemPrompt: 'You are a digital marketing budget pacing agent.',
      model: 'claude-sonnet-4-6',
    },
    { anthropic: fakeAnthropic }
  )

  console.log('\n--- agent result ---')
  console.log('text:', result.text)
  console.log('usedMcp:', result.usedMcp)
  console.log('toolCalls:', JSON.stringify(result.toolCalls.map(t => t.name)))

  assert(result.usedMcp, 'MCP tools were advertised to the model')
  assert(seenToolNames.includes('get_account_summary'), 'get_account_summary tool was offered to the model')
  assert(result.toolCalls.length === 1, 'exactly one tool call was executed')
  assert(result.toolCalls[0].name === 'get_account_summary', 'the executed tool was get_account_summary')
  assert(
    result.toolCalls[0].result.includes('"accountPacingIndex": 1.101'),
    'MCP returned the real computed accountPacingIndex (1.101)'
  )
  assert(toolResultSeen.includes('accountPacingIndex'), 'tool_result was threaded back to the model')
  assert(result.text.includes('marginally over pace'), 'final answer was produced from the tool result')

  console.log('\nALL ASSERTIONS PASSED')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

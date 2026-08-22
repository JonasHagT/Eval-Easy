#!/usr/bin/env node
// MCP server for the digital-marketing budget-pacing agent.
// Exposes read-only tools over stdio that surface campaign spend data and
// computed pacing metrics. Data source: data/campaigns.json.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { computePacing, computeAccountSummary } from './pacing.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'data', 'campaigns.json')

function loadData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  return JSON.parse(raw)
}

const TOOLS = [
  {
    name: 'list_campaigns',
    description:
      'List every digital-marketing campaign in the account with its channel, objective, total budget, spend-to-date, and flight dates. Use this to discover which campaigns exist before analysing pacing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_pacing',
    description:
      'Compute budget-pacing metrics as of the account reference date. Returns ideal spend-to-date, pacing index (actual/ideal), status (over-pacing / on-track / under-pacing), projected end-of-flight spend, projected variance vs budget, and the recommended remaining daily budget. Omit campaignId to get pacing for all campaigns.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: {
          type: 'string',
          description: 'Optional campaign id (e.g. "cmp-meta-prospecting"). If omitted, returns all campaigns.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_account_summary',
    description:
      'Roll all campaigns up into an account-level pacing summary: total budget, total spend-to-date, total ideal spend, account pacing index, projected end spend and variance, and the lists of over-pacing / under-pacing / on-track campaign ids.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

const server = new Server(
  { name: 'budget-pacing', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params
  const data = loadData()

  const asText = payload => ({
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  })

  try {
    if (name === 'list_campaigns') {
      return asText({
        account: data.account,
        currency: data.currency,
        asOfDate: data.asOfDate,
        campaigns: data.campaigns.map(c => ({
          id: c.id,
          name: c.name,
          channel: c.channel,
          objective: c.objective,
          budget: c.budget,
          spendToDate: c.spendToDate,
          flightStart: c.flightStart,
          flightEnd: c.flightEnd,
        })),
      })
    }

    if (name === 'get_pacing') {
      const campaignId = args?.campaignId
      if (campaignId) {
        const c = data.campaigns.find(x => x.id === campaignId)
        if (!c) {
          return {
            content: [{ type: 'text', text: `No campaign found with id "${campaignId}".` }],
            isError: true,
          }
        }
        return asText({ asOfDate: data.asOfDate, currency: data.currency, pacing: computePacing(c, data.asOfDate) })
      }
      return asText({
        asOfDate: data.asOfDate,
        currency: data.currency,
        pacing: data.campaigns.map(c => computePacing(c, data.asOfDate)),
      })
    }

    if (name === 'get_account_summary') {
      return asText({
        currency: data.currency,
        account: data.account,
        summary: computeAccountSummary(data.campaigns, data.asOfDate),
      })
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Tool error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Log to stderr so we never corrupt the stdio JSON-RPC channel on stdout.
  console.error('budget-pacing MCP server ready')
}

main().catch(err => {
  console.error('Fatal MCP server error:', err)
  process.exit(1)
})

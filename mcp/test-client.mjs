// Standalone MCP client that exercises the budget-pacing server over stdio.
// Run: node mcp/test-client.mjs
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverPath = path.join(__dirname, 'budget-pacing-server.mjs')

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: path.join(__dirname, '..'),
})
const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
await client.connect(transport)

const { tools } = await client.listTools()
console.log('== TOOLS ==')
console.log(tools.map(t => `- ${t.name}: ${t.description.slice(0, 60)}...`).join('\n'))

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args })
  console.log(`\n== ${name}(${JSON.stringify(args)}) ${res.isError ? '[ERROR]' : ''} ==`)
  console.log(res.content.map(c => c.text).join('\n'))
}

await call('get_account_summary')
await call('get_pacing', { campaignId: 'cmp-tiktok-awareness' })
await call('get_pacing')
await call('get_pacing', { campaignId: 'cmp-nonexistent' })
await call('list_campaigns')

await client.close()
console.log('\n== done ==')

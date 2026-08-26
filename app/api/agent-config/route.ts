import { NextResponse } from 'next/server'
import { getConsoleAgentInfo, isConsoleAgentConfigured } from '@/lib/managedAgent'

export async function GET() {
  try {
    if (!isConsoleAgentConfigured()) {
      return NextResponse.json({ source: 'messages' })
    }

    const info = await getConsoleAgentInfo()
    return NextResponse.json(info)
  } catch (err) {
    console.error('Agent config error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load Console agent' },
      { status: 500 }
    )
  }
}

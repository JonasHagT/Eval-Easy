import { NextResponse } from 'next/server'
import { readEvals, evalsToCSV } from '@/lib/evalStore'

export async function GET() {
  const evals = readEvals()
  const csv = evalsToCSV(evals)
  const date = new Date().toISOString().split('T')[0]
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="evals-${date}.csv"`,
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { parseEvalFile } from '@/lib/parseEvalFile'
import { applyColumnMap } from '@/lib/columnMap'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a csv, xlsx, xls, docx, pptx, or pdf file' }, { status: 400 })
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'File is larger than 12 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseEvalFile({ name: file.name, buffer })
    const previewRows = applyColumnMap(parsed.rows, parsed.suggestedMap)

    return NextResponse.json({
      ...parsed,
      previewRows,
    })
  } catch (err) {
    console.error('Eval set parse error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not parse file' },
      { status: 400 }
    )
  }
}

import fs from 'fs'
import path from 'path'
import { applyColumnMap } from '../lib/columnMap'
import { parseEvalFile } from '../lib/parseEvalFile'

async function main() {
  const files = process.argv.slice(2)
  for (const file of files) {
    const buffer = fs.readFileSync(file)
    const parsed = await parseEvalFile({ name: path.basename(file), buffer })
    const rows = applyColumnMap(parsed.rows, parsed.suggestedMap)
    console.log('\n===', path.basename(file), '===')
    console.log('type', parsed.sourceType, 'columns', parsed.columns)
    console.log('map', parsed.suggestedMap)
    console.log('warnings', parsed.warnings)
    console.log('rows', rows.length)
    rows.slice(0, 12).forEach(r => {
      console.log(`  ${r.id}. ${r.question.slice(0, 80)}`)
      console.log(`     expected: ${r.expected.slice(0, 80)}`)
    })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

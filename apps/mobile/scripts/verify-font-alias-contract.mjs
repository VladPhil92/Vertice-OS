import './verify-critical-secondary-surfaces.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '../app')

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [absolute] : []
  })
}

const failures = []
const rules = [
  {
    pattern: /fontFamily:\s*typography\.bodyFamily,(?:(?!\}).){0,240}fontWeight:\s*['"](?:600|700|800)['"]/gs,
    message: 'regular Inter alias cannot be paired with a semibold/bold/extrabold weight',
  },
  {
    pattern: /fontFamily:\s*typography\.bodyFamily,(?:(?!\}).){0,240}\.\.\.typography\.roles\.(?:label|button|caption)/gs,
    message: 'weighted semantic role must use its matching bundled Inter alias',
  },
  {
    pattern: /fontFamily:\s*typography\.displayFamily,(?:(?!\}).){0,240}fontWeight:\s*['"](?:400|500|600|700)['"]/gs,
    message: 'default display alias is Montserrat ExtraBold; lighter display weights require an explicit bundled alias',
  },
]

for (const file of walk(appRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const rule of rules) {
    rule.pattern.lastIndex = 0
    if (rule.pattern.test(source)) {
      failures.push(`${path.relative(appRoot, file)}: ${rule.message}`)
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[font-alias-contract] FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('[font-alias-contract] OK: weighted native text resolves to explicit bundled Montserrat/Inter aliases.')
}

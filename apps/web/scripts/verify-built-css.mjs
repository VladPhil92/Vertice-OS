import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const cssDir = join(process.cwd(), '.next', 'static', 'css')
const files = (await readdir(cssDir)).filter((file) => file.endsWith('.css'))

if (files.length === 0) {
  throw new Error('No compiled CSS assets were produced by Next.js.')
}

let compiledUtilityFound = false

for (const file of files) {
  const css = await readFile(join(cssDir, file), 'utf8')

  if (/@tailwind\s|@apply\s/.test(css)) {
    throw new Error(`Uncompiled Tailwind/PostCSS directive found in ${file}.`)
  }

  if (/\.flex\{display:flex\}/.test(css) || /display:flex/.test(css)) {
    compiledUtilityFound = true
  }
}

if (!compiledUtilityFound) {
  throw new Error('Expected compiled Tailwind utility output was not found.')
}

console.log(`Verified ${files.length} compiled CSS asset(s): Tailwind/PostCSS output is production-safe.`)

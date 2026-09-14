import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

function parseArgs(argv) {
  const options = { output: '.artifacts/performance-baseline.json' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--output') options.output = argv[++index]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Required artifact directory does not exist: ${normalize(path.relative(process.cwd(), rootDir))}`)
  }

  const files = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(absolute)
      else if (entry.isFile() && !entry.name.endsWith('.map')) files.push(absolute)
    }
  }
  return files.sort((a, b) => a.localeCompare(b))
}

function bytes(files) {
  return files.reduce((total, file) => total + fs.statSync(file).size, 0)
}

function largestFile(files, rootDir) {
  if (files.length === 0) return { path: null, bytes: 0 }
  const ranked = files
    .map((file) => ({ path: normalize(path.relative(rootDir, file)), bytes: fs.statSync(file).size }))
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
  return ranked[0]
}

function summarize(rootDir) {
  const files = walkFiles(rootDir)
  const js = files.filter((file) => /\.(?:js|mjs|cjs)$/i.test(file))
  const css = files.filter((file) => /\.css$/i.test(file))
  const fonts = files.filter((file) => /\.(?:woff2?|ttf|otf)$/i.test(file))
  const images = files.filter((file) => /\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(file))

  return {
    files: files.length,
    bytes: bytes(files),
    js: { files: js.length, bytes: bytes(js), largest: largestFile(js, rootDir) },
    css: { files: css.length, bytes: bytes(css), largest: largestFile(css, rootDir) },
    fonts: { files: fonts.length, bytes: bytes(fonts), largest: largestFile(fonts, rootDir) },
    images: { files: images.length, bytes: bytes(images), largest: largestFile(images, rootDir) },
    largest: largestFile(files, rootDir),
  }
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase()
  } catch {
    const eventSha = process.env.GITHUB_SHA ?? ''
    if (/^[0-9a-f]{40}$/i.test(eventSha)) return eventSha.toLowerCase()
    throw new Error('Unable to determine the checked-out Git SHA.')
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const root = process.cwd()

  const report = {
    schema_version: '1.0',
    source_sha: gitSha(),
    measurement_contract: {
      source_maps_excluded: true,
      compression: 'raw build/export artifact bytes',
      timing_budgeted: false,
      note: 'Artifact bytes are deterministic release-engineering signals. They are not a substitute for physical-device startup, runtime memory, network or Core Web Vitals evidence.',
    },
    web: {
      client_static: summarize(path.join(root, 'apps/web/.next/static')),
      public_assets: summarize(path.join(root, 'apps/web/public')),
    },
    mobile: {
      android_export: summarize(path.join(root, 'apps/mobile/dist/android')),
      ios_export: summarize(path.join(root, 'apps/mobile/dist/ios')),
    },
  }

  const output = path.resolve(root, options.output)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Performance artifact baseline measured for ${report.source_sha}`)
  console.log(`- Web client static: ${report.web.client_static.bytes} bytes`)
  console.log(`- Web public assets: ${report.web.public_assets.bytes} bytes`)
  console.log(`- Android export: ${report.mobile.android_export.bytes} bytes`)
  console.log(`- iOS export: ${report.mobile.ios_export.bytes} bytes`)
  console.log(`Report: ${normalize(path.relative(root, output))}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

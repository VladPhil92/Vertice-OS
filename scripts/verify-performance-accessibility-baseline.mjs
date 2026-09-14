import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const options = {
    baseline: 'release/baselines/performance-accessibility.json',
    performance: '.artifacts/performance-baseline.json',
    accessibility: '.artifacts/accessibility-baseline.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--baseline') options.baseline = argv[++index]
    else if (arg === '--performance') options.performance = argv[++index]
    else if (arg === '--accessibility') options.accessibility = argv[++index]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'))
}

function performanceMetrics(report) {
  return {
    web_client_static_bytes: report.web.client_static.bytes,
    web_client_runtime_code_bytes: report.web.client_static.runtime_code.bytes,
    web_client_css_bytes: report.web.client_static.css.bytes,
    web_client_largest_bytes: report.web.client_static.largest.bytes,
    web_public_assets_bytes: report.web.public_assets.bytes,
    web_public_largest_bytes: report.web.public_assets.largest.bytes,
    android_export_bytes: report.mobile.android_export.bytes,
    android_runtime_code_bytes: report.mobile.android_export.runtime_code.bytes,
    android_largest_bytes: report.mobile.android_export.largest.bytes,
    ios_export_bytes: report.mobile.ios_export.bytes,
    ios_runtime_code_bytes: report.mobile.ios_export.runtime_code.bytes,
    ios_largest_bytes: report.mobile.ios_export.largest.bytes,
  }
}

function fail(errors, message) {
  errors.push(message)
}

function validateBootstrap(baseline, performance, accessibility) {
  const errors = []
  if (baseline.schema_version !== '1.0') fail(errors, 'Baseline schema_version must be 1.0.')
  if (baseline.mode !== 'bootstrap') fail(errors, 'Bootstrap baseline must declare mode=bootstrap.')
  if (!performance?.web?.client_static?.runtime_code || !performance?.mobile?.android_export?.runtime_code || !performance?.mobile?.ios_export?.runtime_code) {
    fail(errors, 'Performance measurement is incomplete or lacks runtime-code classification.')
  }
  if (!Array.isArray(accessibility?.routes) || accessibility.routes.length === 0) {
    fail(errors, 'Accessibility measurement contains no routes.')
  }
  if (errors.length > 0) throw new Error(errors.join('\n'))
  console.log('Performance & Accessibility Baseline: BOOTSTRAP MEASUREMENT PASS')
  console.log('No regression ceiling is enforced yet. Freeze the measured artifact into the controlled baseline before merge.')
}

function validateEnforced(baseline, performance, accessibility) {
  const errors = []
  const shaRe = /^[0-9a-f]{40}$/i
  if (baseline.schema_version !== '1.0') fail(errors, 'Baseline schema_version must be 1.0.')
  if (baseline.mode !== 'enforced') fail(errors, 'Controlled baseline must declare mode=enforced.')
  if (!shaRe.test(baseline.baseline_sha ?? '') || /^0{40}$/.test(baseline.baseline_sha ?? '')) {
    fail(errors, 'baseline_sha must be a real 40-character Git SHA.')
  }
  if (!baseline.performance_ceilings || typeof baseline.performance_ceilings !== 'object') {
    fail(errors, 'performance_ceilings are required.')
  }
  if (!baseline.accessibility_ceilings || typeof baseline.accessibility_ceilings !== 'object') {
    fail(errors, 'accessibility_ceilings are required.')
  }

  const currentPerformance = performanceMetrics(performance)
  for (const [metric, current] of Object.entries(currentPerformance)) {
    const ceiling = baseline.performance_ceilings?.[metric]
    if (!Number.isInteger(ceiling) || ceiling < 0) {
      fail(errors, `Missing non-negative integer performance ceiling: ${metric}`)
      continue
    }
    if (!Number.isInteger(current) || current < 0) {
      fail(errors, `Current performance metric is invalid: ${metric}`)
      continue
    }
    if (current > ceiling) {
      fail(errors, `${metric}: ${current} bytes exceeds controlled baseline ceiling ${ceiling} bytes.`)
    }
  }

  const baselineRoutes = baseline.accessibility_ceilings?.routes ?? {}
  const currentRoutes = Object.fromEntries(accessibility.routes.map((route) => [route.route, route]))
  const baselineRouteNames = Object.keys(baselineRoutes).sort()
  const currentRouteNames = Object.keys(currentRoutes).sort()
  if (JSON.stringify(baselineRouteNames) !== JSON.stringify(currentRouteNames)) {
    fail(errors, `Accessibility route set drifted. baseline=${baselineRouteNames.join(',')} current=${currentRouteNames.join(',')}`)
  }

  const totalCeiling = baseline.accessibility_ceilings?.total_issues
  if (!Number.isInteger(totalCeiling) || totalCeiling < 0) {
    fail(errors, 'accessibility_ceilings.total_issues must be a non-negative integer.')
  } else if (accessibility.total_issues > totalCeiling) {
    fail(errors, `Accessibility total issues ${accessibility.total_issues} exceed baseline ceiling ${totalCeiling}.`)
  }

  for (const routeName of baselineRouteNames) {
    const ceiling = baselineRoutes[routeName]
    const current = currentRoutes[routeName]
    if (!current) continue
    if (!Number.isInteger(ceiling.total_issues) || ceiling.total_issues < 0) {
      fail(errors, `${routeName}: total_issues ceiling must be a non-negative integer.`)
    } else if (current.total_issues > ceiling.total_issues) {
      fail(errors, `${routeName}: ${current.total_issues} accessibility issues exceed route ceiling ${ceiling.total_issues}.`)
    }

    const baselineCodes = ceiling.issues_by_code ?? {}
    const currentCodes = current.issues_by_code ?? {}
    const allCodes = new Set([...Object.keys(baselineCodes), ...Object.keys(currentCodes)])
    for (const code of [...allCodes].sort()) {
      const codeCeiling = baselineCodes[code] ?? 0
      const codeCurrent = currentCodes[code] ?? 0
      if (!Number.isInteger(codeCeiling) || codeCeiling < 0) {
        fail(errors, `${routeName}/${code}: invalid baseline ceiling.`)
      } else if (codeCurrent > codeCeiling) {
        fail(errors, `${routeName}/${code}: ${codeCurrent} exceeds baseline ceiling ${codeCeiling}.`)
      }
    }
  }

  if (errors.length > 0) {
    console.error('Performance & Accessibility Baseline: FAILED')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log(`Performance & Accessibility Baseline: PASS against ${baseline.baseline_sha}`)
  console.log('Current artifact bytes do not exceed the measured ceilings and deterministic accessibility debt did not increase.')
  console.log('Timing observations remain informational and are intentionally not budgeted by this gate.')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const baseline = readJson(options.baseline)
  const performance = readJson(options.performance)
  const accessibility = readJson(options.accessibility)

  if (baseline.mode === 'bootstrap') validateBootstrap(baseline, performance, accessibility)
  else validateEnforced(baseline, performance, accessibility)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const DEFAULT_ROUTES = ['/', '/auth/login', '/auth/register', '/account-deletion']

function parseArgs(argv) {
  const options = {
    baseUrl: 'http://localhost:3000',
    output: '.artifacts/accessibility-baseline.json',
    routes: DEFAULT_ROUTES,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--base-url') options.baseUrl = argv[++index]
    else if (arg === '--output') options.output = argv[++index]
    else if (arg === '--routes') options.routes = argv[++index].split(',').map((route) => route.trim()).filter(Boolean)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function countByCode(issues) {
  return issues.reduce((counts, issue) => {
    counts[issue.code] = (counts[issue.code] ?? 0) + 1
    return counts
  }, {})
}

async function inspectRoute(page, baseUrl, route) {
  const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  if (!response || response.status() >= 400) {
    throw new Error(`${route}: navigation failed with HTTP ${response?.status() ?? 'no-response'}`)
  }

  await page.waitForTimeout(250)

  const result = await page.evaluate(() => {
    function text(value) {
      return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
    }

    function referencedLabel(element) {
      const ids = text(element.getAttribute('aria-labelledby')).split(' ').filter(Boolean)
      if (ids.length === 0) return ''
      return ids.map((id) => text(document.getElementById(id)?.textContent)).filter(Boolean).join(' ')
    }

    function accessibleNameLike(element) {
      const aria = text(element.getAttribute('aria-label'))
      if (aria) return aria
      const referenced = referencedLabel(element)
      if (referenced) return referenced
      const content = text(element.textContent)
      if (content) return content
      const title = text(element.getAttribute('title'))
      if (title) return title
      const imageAlt = text(element.querySelector('img[alt]')?.getAttribute('alt'))
      if (imageAlt) return imageAlt
      return ''
    }

    const issues = []
    const push = (code, selector, note) => issues.push({ code, selector, note })

    document.querySelectorAll('img').forEach((element, index) => {
      if (!element.hasAttribute('alt')) push('img_missing_alt', `img:nth-of-type(${index + 1})`, 'Image is missing an alt attribute.')
    })

    document.querySelectorAll('button').forEach((element, index) => {
      if (!accessibleNameLike(element)) push('button_missing_name', `button:nth-of-type(${index + 1})`, 'Button has no accessible-name signal.')
    })

    document.querySelectorAll('a[href]').forEach((element, index) => {
      if (!accessibleNameLike(element)) push('link_missing_name', `a:nth-of-type(${index + 1})`, 'Link has no accessible-name signal.')
    })

    document.querySelectorAll('[role="button"]').forEach((element, index) => {
      if (element.tagName.toLowerCase() !== 'button' && !accessibleNameLike(element)) {
        push('role_button_missing_name', `[role="button"]:nth-of-type(${index + 1})`, 'Element with button role has no accessible-name signal.')
      }
    })

    document.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach((element, index) => {
      const labels = 'labels' in element && element.labels ? Array.from(element.labels) : []
      const hasProgrammaticLabel = labels.some((label) => text(label.textContent))
        || Boolean(text(element.getAttribute('aria-label')))
        || Boolean(referencedLabel(element))
      if (!hasProgrammaticLabel) {
        push('form_control_missing_label', `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`, 'Form control has no associated label, aria-label or aria-labelledby.')
      }
    })

    const ids = new Map()
    document.querySelectorAll('[id]').forEach((element) => {
      const id = element.id
      if (!id) return
      ids.set(id, (ids.get(id) ?? 0) + 1)
    })
    for (const [id, count] of ids.entries()) {
      if (count > 1) push('duplicate_id', `#${id}`, `ID is used ${count} times.`)
    }

    if (!text(document.documentElement.getAttribute('lang'))) {
      push('html_missing_lang', 'html', 'Root HTML element has no lang attribute.')
    }

    if (!document.querySelector('main, [role="main"]')) {
      push('missing_main_landmark', 'body', 'Page has no main landmark.')
    }

    const navigation = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const resourceSummary = resources.reduce((summary, entry) => {
      const url = entry.name.toLowerCase()
      if (url.includes('.js')) summary.js_encoded_bytes += entry.encodedBodySize || 0
      if (url.includes('.css')) summary.css_encoded_bytes += entry.encodedBodySize || 0
      summary.encoded_bytes += entry.encodedBodySize || 0
      summary.resources += 1
      return summary
    }, { resources: 0, encoded_bytes: 0, js_encoded_bytes: 0, css_encoded_bytes: 0 })

    return {
      title: document.title,
      dom_nodes: document.querySelectorAll('*').length,
      issues,
      runtime_observation: {
        navigation_duration_ms: navigation ? Math.round(navigation.duration) : null,
        dom_content_loaded_ms: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
        load_event_ms: navigation ? Math.round(navigation.loadEventEnd) : null,
        ...resourceSummary,
      },
    }
  })

  return {
    route,
    title: result.title,
    dom_nodes: result.dom_nodes,
    total_issues: result.issues.length,
    issues_by_code: countByCode(result.issues),
    issues: result.issues,
    runtime_observation: result.runtime_observation,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ locale: 'es-CO', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const routes = []

  try {
    for (const route of options.routes) {
      routes.push(await inspectRoute(page, options.baseUrl, route))
    }
  } finally {
    await browser.close()
  }

  const report = {
    schema_version: '1.0',
    base_url: options.baseUrl,
    measurement_contract: {
      routes: options.routes,
      rule_scope: [
        'img alt presence',
        'button/link/role=button accessible-name signals',
        'form-control programmatic labels',
        'duplicate ids',
        'document language',
        'main landmark',
      ],
      note: 'This deterministic browser heuristic is a regression ratchet, not a WCAG conformance certification or substitute for assistive-technology/manual testing.',
    },
    total_issues: routes.reduce((total, route) => total + route.total_issues, 0),
    routes,
  }

  const output = path.resolve(process.cwd(), options.output)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Accessibility baseline measured across ${routes.length} public routes.`)
  console.log(`Total deterministic heuristic issues: ${report.total_issues}`)
  for (const route of routes) console.log(`- ${route.route}: ${route.total_issues}`)
  console.log(`Report: ${path.relative(process.cwd(), output)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

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
      const selector = `[role="button"]:nth-of-type(${index + 1})`
      const tagName = element.tagName.toLowerCase()
      if (tagName !== 'button' && !accessibleNameLike(element)) {
        push('role_button_missing_name', selector, 'Element with button role has no accessible-name signal.')
      }
      const disabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true'
      if (!disabled && element.tabIndex < 0) {
        push('role_button_not_tabbable', selector, 'Enabled element with button role is not keyboard-tabbable.')
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

    const mainLandmarks = document.querySelectorAll('main, [role="main"]')
    if (mainLandmarks.length === 0) push('missing_main_landmark', 'body', 'Page has no main landmark.')
    if (mainLandmarks.length > 1) push('multiple_main_landmarks', 'body', `Page exposes ${mainLandmarks.length} main landmarks.`)

    const h1s = document.querySelectorAll('h1')
    if (h1s.length === 0) push('missing_h1', 'body', 'Page has no level-one heading.')
    if (h1s.length > 1) push('multiple_h1', 'body', `Page exposes ${h1s.length} level-one headings.`)

    const focusableElements = Array.from(document.querySelectorAll('a[href], button, input:not([type="hidden"]), textarea, select, [tabindex]'))
      .filter((element) => {
        const style = getComputedStyle(element)
        return !element.hasAttribute('disabled')
          && element.getAttribute('aria-hidden') !== 'true'
          && element.tabIndex >= 0
          && style.display !== 'none'
          && style.visibility !== 'hidden'
      }).length

    const navigation = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const resourceSummary = resources.reduce((summary, entry) => {
      const url = entry.name.toLowerCase()
      const encoded = entry.encodedBodySize || 0
      const decoded = entry.decodedBodySize || 0
      if (url.includes('.js')) {
        summary.js_encoded_bytes += encoded
        summary.js_decoded_bytes += decoded
      }
      if (url.includes('.css')) {
        summary.css_encoded_bytes += encoded
        summary.css_decoded_bytes += decoded
      }
      summary.encoded_bytes += encoded
      summary.decoded_bytes += decoded
      summary.resources += 1
      return summary
    }, {
      resources: 0,
      encoded_bytes: 0,
      decoded_bytes: 0,
      js_encoded_bytes: 0,
      js_decoded_bytes: 0,
      css_encoded_bytes: 0,
      css_decoded_bytes: 0,
    })

    return {
      title: document.title,
      dom_nodes: document.querySelectorAll('*').length,
      focusable_elements: focusableElements,
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
    focusable_elements: result.focusable_elements,
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
    schema_version: '1.2',
    base_url: options.baseUrl,
    measurement_contract: {
      routes: options.routes,
      rule_scope: [
        'img alt presence',
        'button/link/role=button accessible-name signals',
        'enabled role=button keyboard tabbability',
        'form-control programmatic labels',
        'duplicate ids',
        'document language',
        'exactly one main landmark',
        'exactly one level-one heading',
      ],
      runtime_resource_scope: 'Per-route decoded resource body bytes are candidates for exact regression ceilings. Encoded transfer bytes and wall-clock timings remain observations because repeated same-source runs demonstrated transport-level variance.',
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
  for (const route of routes) {
    console.log(`- ${route.route}: ${route.total_issues} issues; ${route.runtime_observation.js_decoded_bytes} decoded JS bytes`)
  }
  console.log(`Report: ${path.relative(process.cwd(), output)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

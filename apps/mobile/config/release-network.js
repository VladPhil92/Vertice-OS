const { isIP } = require('node:net')

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
}

function isPrivateIpv4(host) {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false
  const [a, b] = parts

  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
  )
}

function mappedIpv4FromIpv6(host) {
  const dotted = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (dotted) return dotted[1]

  // WHATWG URL canonicalizes addresses such as ::ffff:192.168.1.1 to
  // ::ffff:c0a8:101. Convert the two trailing 16-bit groups back to IPv4.
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!hex) return null

  const high = Number.parseInt(hex[1], 16)
  const low = Number.parseInt(hex[2], 16)
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}

function isPrivateIpv6(host) {
  if (host === '::' || host === '::1') return true

  const mappedIpv4 = mappedIpv4FromIpv6(host)
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4)

  const firstGroup = Number.parseInt(host.split(':')[0] || '0', 16)
  if (!Number.isFinite(firstGroup)) return false

  // fc00::/7 unique-local and fe80::/10 link-local.
  return (firstGroup & 0xfe00) === 0xfc00 || (firstGroup & 0xffc0) === 0xfe80
}

function isLocalOrPrivateHostname(hostname) {
  const host = normalizeHostname(hostname)
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true

  const ipVersion = isIP(host)
  if (ipVersion === 4) return isPrivateIpv4(host)
  if (ipVersion === 6) return isPrivateIpv6(host)

  // Public release hosts must be DNS-qualified. Single-label names are usually
  // private service-discovery names (for example `api` or `backend`).
  if (!host.includes('.')) return true

  return false
}

function parsePublicHttpsUrl(value, label = 'release URL') {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not embed credentials`)
  }
  if (isLocalOrPrivateHostname(parsed.hostname)) {
    throw new Error(`${label} must use a public, non-local hostname`)
  }

  return parsed
}

module.exports = {
  normalizeHostname,
  isLocalOrPrivateHostname,
  parsePublicHttpsUrl,
}

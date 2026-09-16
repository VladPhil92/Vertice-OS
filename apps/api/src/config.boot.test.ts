import { spawnSync } from 'node:child_process'
import path from 'node:path'

// config.ts validates process.env at import time and calls process.exit(1) on
// failure, so the only faithful way to test that boot-time behavior is to
// actually boot it in a subprocess — importing it in-process would kill the
// Jest worker.
const CONFIG_ENTRY = path.join(__dirname, 'config.ts')

const REQUIRED_BASE_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/vertice',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
}

const TSX_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx')

function bootConfig(extraEnv: Record<string, string>) {
  // Strip any pilot vars this Jest process itself inherited (from the shell,
  // CI, or a .env file) so a case that doesn't set them — e.g. the "gate
  // disabled" test below — actually exercises the unset state instead of
  // silently reusing whatever the calling environment happened to have.
  const { CLOSED_PILOT_MODE: _mode, CLOSED_PILOT_EMAIL_ALLOWLIST: _allowlist, ...inheritedEnv } = process.env

  return spawnSync(TSX_BIN, [CONFIG_ENTRY], {
    cwd: path.join(__dirname, '..'),
    env: { ...inheritedEnv, ...REQUIRED_BASE_ENV, ...extraEnv },
    encoding: 'utf8',
  })
}

describe('config.ts closed-pilot boot guard', () => {
  it('refuses to boot when CLOSED_PILOT_MODE=true with an empty allowlist', () => {
    const result = bootConfig({ CLOSED_PILOT_MODE: 'true', CLOSED_PILOT_EMAIL_ALLOWLIST: '' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('CLOSED_PILOT_MODE=true but CLOSED_PILOT_EMAIL_ALLOWLIST is empty')
  })

  it('refuses to boot when the allowlist exceeds the 30-person cohort cap', () => {
    const oversized = Array.from({ length: 31 }, (_, i) => `citizen${i}@example.com`).join(',')
    const result = bootConfig({ CLOSED_PILOT_MODE: 'true', CLOSED_PILOT_EMAIL_ALLOWLIST: oversized })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('too large (31 > 30)')
  })

  it('refuses to boot when the allowlist contains a malformed email', () => {
    const result = bootConfig({ CLOSED_PILOT_MODE: 'true', CLOSED_PILOT_EMAIL_ALLOWLIST: 'founder@example.com,not-an-email' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('contains invalid email(s): not-an-email')
  })

  it('refuses to boot when CLOSED_PILOT_MODE is a near-miss like "TRUE"', () => {
    const result = bootConfig({ CLOSED_PILOT_MODE: 'TRUE' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('FATAL')
  })

  it('boots normally when CLOSED_PILOT_MODE=true with a valid allowlist', () => {
    const result = bootConfig({ CLOSED_PILOT_MODE: 'true', CLOSED_PILOT_EMAIL_ALLOWLIST: 'founder@example.com' })

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('FATAL')
  })

  it('boots normally when CLOSED_PILOT_MODE is unset (pilot gate disabled)', () => {
    const result = bootConfig({})

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('FATAL')
  })
})

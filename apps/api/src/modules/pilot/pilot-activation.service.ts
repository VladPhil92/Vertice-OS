import crypto from 'node:crypto'
import { redis } from '../../lib/redis'
import { getClosedPilotAccessState } from '../../lib/closed-pilot-access'
import { assessClosedPilotReadiness } from '../../lib/closed-pilot-readiness'
import { getFeatureCapabilities } from '../../lib/feature-secrets'
import { probeRuntimeDependencies } from '../../lib/runtime-probe'
import { deployedPilotRevision, getPilotObservabilityState } from './pilot.service'

const ACTIVATION_KEY = 'vertice:pilot:v1:activation'
const FULL_GIT_COMMIT_SHA = /^[0-9a-f]{40}$/i

export interface PilotActivationRecord {
  state: 'active' | 'paused'
  revision: string
  cohort_fingerprint: string | null
  cohort_size: number
  changed_at: string
}

export interface PilotActivationState {
  state: 'active' | 'paused'
  current: boolean
  revision: string
  cohort_fingerprint: string | null
  cohort_size: number
  blockers: string[]
  changed_at: string | null
}

function normalizedAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  return Array.from(new Set(
    (env.CLOSED_PILOT_EMAIL_ALLOWLIST ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )).sort()
}

export function pilotCohortFingerprint(env: NodeJS.ProcessEnv = process.env): string | null {
  const pepper = env.PILOT_TELEMETRY_PEPPER?.trim()
  const allowlist = normalizedAllowlist(env)
  if (!pepper || pepper.length < 32 || allowlist.length === 0) return null

  return crypto
    .createHmac('sha256', pepper)
    .update(allowlist.join('\n'))
    .digest('hex')
    .slice(0, 24)
}

export function assessPilotActivationCurrent(
  record: PilotActivationRecord | null,
  context: {
    revision: string
    cohort_fingerprint: string | null
    cohort_size: number
    access_configured: boolean
    observability_configured: boolean
  },
): PilotActivationState {
  const blockers: string[] = []

  if (!context.access_configured) blockers.push('pilot:access_control_not_ready')
  if (!context.observability_configured) blockers.push('pilot:observability_not_ready')
  if (!FULL_GIT_COMMIT_SHA.test(context.revision)) blockers.push('runtime:revision_invalid')
  if (!context.cohort_fingerprint) blockers.push('pilot:cohort_fingerprint_unavailable')

  if (!record) {
    blockers.push('pilot:runtime_activation_missing')
  } else {
    if (record.state !== 'active') blockers.push('pilot:runtime_activation_paused')
    if (record.revision !== context.revision) blockers.push('pilot:runtime_activation_revision_drift')
    if (record.cohort_fingerprint !== context.cohort_fingerprint) {
      blockers.push('pilot:runtime_activation_cohort_drift')
    }
    if (record.cohort_size !== context.cohort_size) {
      blockers.push('pilot:runtime_activation_cohort_size_drift')
    }
  }

  const uniqueBlockers = Array.from(new Set(blockers)).sort()
  return {
    state: record?.state ?? 'paused',
    current: uniqueBlockers.length === 0,
    revision: context.revision,
    cohort_fingerprint: context.cohort_fingerprint,
    cohort_size: context.cohort_size,
    blockers: uniqueBlockers,
    changed_at: record?.changed_at ?? null,
  }
}

async function readActivationRecord(): Promise<PilotActivationRecord | null> {
  const raw = await redis.get(ACTIVATION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PilotActivationRecord>
    if (
      (parsed.state === 'active' || parsed.state === 'paused')
      && typeof parsed.revision === 'string'
      && (typeof parsed.cohort_fingerprint === 'string' || parsed.cohort_fingerprint === null)
      && typeof parsed.cohort_size === 'number'
      && typeof parsed.changed_at === 'string'
    ) {
      return parsed as PilotActivationRecord
    }
  } catch {
    // Corrupt or legacy activation state fails closed below.
  }

  return null
}

function currentContext() {
  const access = getClosedPilotAccessState()
  const observability = getPilotObservabilityState()
  return {
    revision: deployedPilotRevision(),
    cohort_fingerprint: pilotCohortFingerprint(),
    cohort_size: access.cohort_size,
    access_configured: access.enabled && access.configured && access.mode === 'closed_invite_only',
    observability_configured: observability.configured,
  }
}

export async function getPilotActivationState(): Promise<PilotActivationState> {
  return assessPilotActivationCurrent(await readActivationRecord(), currentContext())
}

export async function assertPilotActivationCurrent(): Promise<void> {
  const state = await getPilotActivationState()
  if (state.current) return

  throw Object.assign(new Error('El cohorte del piloto requiere activación operativa'), {
    statusCode: 503,
    code: 'PILOT_RUNTIME_ACTIVATION_REQUIRED',
    blockers: state.blockers,
  })
}

export async function activatePilotCohort(expectedRevision: string): Promise<PilotActivationState> {
  const context = currentContext()
  if (expectedRevision !== context.revision) {
    throw Object.assign(new Error('El SHA esperado no coincide con el runtime desplegado'), {
      statusCode: 409,
      code: 'PILOT_ACTIVATION_REVISION_MISMATCH',
      blockers: ['pilot:expected_revision_mismatch'],
    })
  }

  const [{ checks }, capabilities] = await Promise.all([
    probeRuntimeDependencies(),
    Promise.resolve(getFeatureCapabilities()),
  ])
  const access = getClosedPilotAccessState()
  const readiness = assessClosedPilotReadiness({
    checks,
    capabilities,
    access,
    revision: context.revision,
    production: process.env.NODE_ENV === 'production',
  })

  const blockers = [...readiness.blockers]
  if (!context.observability_configured) blockers.push('pilot:observability_not_ready')
  if (!context.cohort_fingerprint) blockers.push('pilot:cohort_fingerprint_unavailable')

  const uniqueBlockers = Array.from(new Set(blockers)).sort()
  if (uniqueBlockers.length > 0) {
    throw Object.assign(new Error('El piloto no supera el preflight de activación'), {
      statusCode: 503,
      code: 'PILOT_ACTIVATION_BLOCKED',
      blockers: uniqueBlockers,
    })
  }

  const record: PilotActivationRecord = {
    state: 'active',
    revision: context.revision,
    cohort_fingerprint: context.cohort_fingerprint,
    cohort_size: context.cohort_size,
    changed_at: new Date().toISOString(),
  }
  await redis.set(ACTIVATION_KEY, JSON.stringify(record))
  return getPilotActivationState()
}

export async function pausePilotCohort(): Promise<PilotActivationState> {
  const context = currentContext()
  const record: PilotActivationRecord = {
    state: 'paused',
    revision: context.revision,
    cohort_fingerprint: context.cohort_fingerprint,
    cohort_size: context.cohort_size,
    changed_at: new Date().toISOString(),
  }
  await redis.set(ACTIVATION_KEY, JSON.stringify(record))
  return getPilotActivationState()
}

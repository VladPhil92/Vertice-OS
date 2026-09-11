import crypto from 'node:crypto'
import { redis } from '../../lib/redis'
import type { PilotFeedbackInput, PilotIncidentInput, PilotTelemetryInput } from './pilot.schema'

const PREFIX = 'vertice:pilot:v1'
const TELEMETRY_STREAM = `${PREFIX}:telemetry`
const FEEDBACK_STREAM = `${PREFIX}:feedback`
const INCIDENT_STREAM = `${PREFIX}:incidents`
const EVENT_COUNTS = `${PREFIX}:event_counts`
const OUTCOME_COUNTS = `${PREFIX}:outcome_counts`
const UNIQUE_USERS = `${PREFIX}:unique_users`
const RETENTION_SECONDS = 30 * 24 * 60 * 60
const TELEMETRY_MAXLEN = 10_000
const FEEDBACK_MAXLEN = 2_000
const INCIDENT_MAXLEN = 500

export function getPilotObservabilityState(env: NodeJS.ProcessEnv = process.env) {
  const pepper = env.PILOT_TELEMETRY_PEPPER?.trim()
  return {
    configured: Boolean(pepper && pepper.length >= 32),
    retention_days: 30,
    storage: 'redis_ephemeral' as const,
  }
}

function requirePilotPepper(): string {
  const pepper = process.env.PILOT_TELEMETRY_PEPPER?.trim()
  if (!pepper || pepper.length < 32) {
    throw Object.assign(new Error('Pilot observability is not configured'), {
      statusCode: 503,
      code: 'PILOT_OBSERVABILITY_NOT_CONFIGURED',
    })
  }
  return pepper
}

export function pilotPseudonym(citizenId: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(citizenId).digest('hex').slice(0, 24)
}

export function redactPilotText(raw: string): string {
  return raw
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[redacted-phone]')
    .replace(/\b\d{6,}\b/g, '[redacted-number]')
    .replace(/\s+/g, ' ')
    .trim()
}

export function deployedPilotRevision(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.RAILWAY_GIT_COMMIT_SHA
    ?? env.GITHUB_SHA
    ?? env.VERCEL_GIT_COMMIT_SHA
    ?? 'unknown'
  return /^[0-9a-f]{40}$/i.test(value) ? value : 'unknown'
}

function timestamp(): string {
  return new Date().toISOString()
}

async function retain(...keys: string[]): Promise<void> {
  const pipeline = redis.multi()
  for (const key of keys) pipeline.expire(key, RETENTION_SECONDS)
  await pipeline.exec()
}

export async function recordPilotTelemetry(citizenId: string, input: PilotTelemetryInput): Promise<{ accepted: true }> {
  const pilotUserId = pilotPseudonym(citizenId, requirePilotPepper())
  const at = timestamp()
  const revision = deployedPilotRevision()

  const fields = [
    'pilot_user_id', pilotUserId,
    'event', input.event,
    'surface', input.surface,
    'outcome', input.outcome,
    'platform', input.platform,
    'revision', revision,
    'observed_at', at,
  ]
  if (input.duration_ms !== undefined) fields.push('duration_ms', String(input.duration_ms))

  const pipeline = redis.multi()
  pipeline.xadd(TELEMETRY_STREAM, 'MAXLEN', '~', TELEMETRY_MAXLEN, '*', ...fields)
  pipeline.hincrby(EVENT_COUNTS, input.event, 1)
  pipeline.hincrby(OUTCOME_COUNTS, input.outcome, 1)
  pipeline.pfadd(UNIQUE_USERS, pilotUserId)
  await pipeline.exec()
  await retain(TELEMETRY_STREAM, EVENT_COUNTS, OUTCOME_COUNTS, UNIQUE_USERS)

  return { accepted: true }
}

export async function recordPilotFeedback(citizenId: string, input: PilotFeedbackInput): Promise<{ accepted: true }> {
  const pilotUserId = pilotPseudonym(citizenId, requirePilotPepper())
  const message = redactPilotText(input.message)
  const fields = [
    'pilot_user_id', pilotUserId,
    'category', input.category,
    'surface', input.surface,
    'message', message,
    'revision', deployedPilotRevision(),
    'observed_at', timestamp(),
  ]
  if (input.rating !== undefined) fields.push('rating', String(input.rating))

  await redis.xadd(FEEDBACK_STREAM, 'MAXLEN', '~', FEEDBACK_MAXLEN, '*', ...fields)
  await retain(FEEDBACK_STREAM)
  return { accepted: true }
}

export async function recordPilotIncident(operatorId: string, input: PilotIncidentInput): Promise<{ accepted: true }> {
  const operator = pilotPseudonym(operatorId, requirePilotPepper())
  await redis.xadd(
    INCIDENT_STREAM,
    'MAXLEN', '~', INCIDENT_MAXLEN,
    '*',
    'operator_id', operator,
    'severity', input.severity,
    'code', input.code,
    'summary', redactPilotText(input.summary),
    'action', input.action,
    'revision', deployedPilotRevision(),
    'observed_at', timestamp(),
  )
  await retain(INCIDENT_STREAM)
  return { accepted: true }
}

type StreamEntry = [string, string[]]

function decode(entry: StreamEntry): Record<string, string> & { id: string } {
  const [id, fields] = entry
  const data: Record<string, string> & { id: string } = { id }
  for (let index = 0; index < fields.length; index += 2) {
    data[fields[index] ?? 'unknown'] = fields[index + 1] ?? ''
  }
  return data
}

function numericRecord(input: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Number(value) || 0]))
}

export async function getPilotOperationsSummary() {
  requirePilotPepper()
  const [eventCounts, outcomeCounts, uniqueUsers, feedback, incidents] = await Promise.all([
    redis.hgetall(EVENT_COUNTS),
    redis.hgetall(OUTCOME_COUNTS),
    redis.pfcount(UNIQUE_USERS),
    redis.xrevrange(FEEDBACK_STREAM, '+', '-', 'COUNT', 20),
    redis.xrevrange(INCIDENT_STREAM, '+', '-', 'COUNT', 20),
  ])

  return {
    status: 'operational',
    retention_days: 30,
    revision: deployedPilotRevision(),
    unique_users_approx: uniqueUsers,
    event_counts: numericRecord(eventCounts),
    outcome_counts: numericRecord(outcomeCounts),
    recent_feedback: (feedback as StreamEntry[]).map(decode),
    recent_incidents: (incidents as StreamEntry[]).map(decode),
    privacy: {
      raw_citizen_ids_stored: false,
      emails_stored: false,
      gps_stored: false,
      arbitrary_event_payloads_allowed: false,
    },
  }
}

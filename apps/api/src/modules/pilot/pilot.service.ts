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
const RETENTION_DAYS = 30
const TELEMETRY_MAXLEN = 10_000
const FEEDBACK_MAXLEN = 2_000
const INCIDENT_MAXLEN = 500

export function getPilotObservabilityState(env: NodeJS.ProcessEnv = process.env) {
  const pepper = env.PILOT_TELEMETRY_PEPPER?.trim()
  return {
    configured: Boolean(pepper && pepper.length >= 32),
    retention_days: RETENTION_DAYS,
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

function dayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function bucketKey(base: string, day: string): string {
  return `${base}:${day}`
}

function bucketExpiryEpoch(day: string): number {
  const expires = new Date(`${day}T00:00:00.000Z`)
  expires.setUTCDate(expires.getUTCDate() + RETENTION_DAYS)
  return Math.floor(expires.getTime() / 1000)
}

function rollingDays(count = RETENTION_DAYS): string[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() - index)
    return dayStamp(date)
  })
}

export async function recordPilotTelemetry(citizenId: string, input: PilotTelemetryInput): Promise<{ accepted: true }> {
  const pilotUserId = pilotPseudonym(citizenId, requirePilotPepper())
  const at = timestamp()
  const revision = deployedPilotRevision()
  const day = dayStamp()
  const streamKey = bucketKey(TELEMETRY_STREAM, day)
  const eventKey = bucketKey(EVENT_COUNTS, day)
  const outcomeKey = bucketKey(OUTCOME_COUNTS, day)
  const usersKey = bucketKey(UNIQUE_USERS, day)
  const expiry = bucketExpiryEpoch(day)

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
  pipeline.xadd(streamKey, 'MAXLEN', '~', String(TELEMETRY_MAXLEN), '*', ...fields)
  pipeline.hincrby(eventKey, input.event, 1)
  pipeline.hincrby(outcomeKey, input.outcome, 1)
  pipeline.pfadd(usersKey, pilotUserId)
  for (const key of [streamKey, eventKey, outcomeKey, usersKey]) pipeline.expireat(key, expiry)
  await pipeline.exec()

  return { accepted: true }
}

export async function recordPilotFeedback(citizenId: string, input: PilotFeedbackInput): Promise<{ accepted: true }> {
  const pilotUserId = pilotPseudonym(citizenId, requirePilotPepper())
  const message = redactPilotText(input.message)
  const day = dayStamp()
  const streamKey = bucketKey(FEEDBACK_STREAM, day)
  const fields = [
    'pilot_user_id', pilotUserId,
    'category', input.category,
    'surface', input.surface,
    'message', message,
    'revision', deployedPilotRevision(),
    'observed_at', timestamp(),
  ]
  if (input.rating !== undefined) fields.push('rating', String(input.rating))

  const pipeline = redis.multi()
  pipeline.xadd(streamKey, 'MAXLEN', '~', String(FEEDBACK_MAXLEN), '*', ...fields)
  pipeline.expireat(streamKey, bucketExpiryEpoch(day))
  await pipeline.exec()
  return { accepted: true }
}

export async function recordPilotIncident(operatorId: string, input: PilotIncidentInput): Promise<{ accepted: true }> {
  const operator = pilotPseudonym(operatorId, requirePilotPepper())
  const day = dayStamp()
  const streamKey = bucketKey(INCIDENT_STREAM, day)
  const pipeline = redis.multi()
  pipeline.xadd(
    streamKey,
    'MAXLEN', '~', String(INCIDENT_MAXLEN),
    '*',
    'operator_id', operator,
    'severity', input.severity,
    'code', input.code,
    'summary', redactPilotText(input.summary),
    'action', input.action,
    'revision', deployedPilotRevision(),
    'observed_at', timestamp(),
  )
  pipeline.expireat(streamKey, bucketExpiryEpoch(day))
  await pipeline.exec()
  return { accepted: true }
}

type StreamEntry = [string, string[]]

type OperationalRecord = Record<string, string> & { id: string }

function decode(entry: StreamEntry): OperationalRecord {
  const [id, fields] = entry
  const data: OperationalRecord = { id }
  for (let index = 0; index < fields.length; index += 2) {
    data[fields[index] ?? 'unknown'] = fields[index + 1] ?? ''
  }
  return data
}

function stripInternalPseudonym(record: OperationalRecord): OperationalRecord {
  const publicRecord: OperationalRecord = { ...record }
  delete publicRecord.pilot_user_id
  delete publicRecord.operator_id
  return publicRecord
}

function aggregateNumericRecords(records: Array<Record<string, string>>): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      totals[key] = (totals[key] ?? 0) + (Number(value) || 0)
    }
  }
  return totals
}

function newestRecords(streams: StreamEntry[][], limit: number): OperationalRecord[] {
  return streams
    .flat()
    .map(decode)
    .sort((left, right) => (right.observed_at ?? '').localeCompare(left.observed_at ?? ''))
    .slice(0, limit)
    .map(stripInternalPseudonym)
}

export async function getPilotOperationsSummary() {
  requirePilotPepper()
  const days = rollingDays()
  const eventKeys = days.map((day) => bucketKey(EVENT_COUNTS, day))
  const outcomeKeys = days.map((day) => bucketKey(OUTCOME_COUNTS, day))
  const userKeys = days.map((day) => bucketKey(UNIQUE_USERS, day))
  const feedbackKeys = days.map((day) => bucketKey(FEEDBACK_STREAM, day))
  const incidentKeys = days.map((day) => bucketKey(INCIDENT_STREAM, day))

  const [eventCounts, outcomeCounts, uniqueUsers, feedbackStreams, incidentStreams] = await Promise.all([
    Promise.all(eventKeys.map((key) => redis.hgetall(key))),
    Promise.all(outcomeKeys.map((key) => redis.hgetall(key))),
    redis.pfcount(...userKeys),
    Promise.all(feedbackKeys.map((key) => redis.xrevrange(key, '+', '-', 'COUNT', 20))),
    Promise.all(incidentKeys.map((key) => redis.xrevrange(key, '+', '-', 'COUNT', 20))),
  ])

  return {
    status: 'operational',
    retention_days: RETENTION_DAYS,
    revision: deployedPilotRevision(),
    unique_users_approx: uniqueUsers,
    event_counts: aggregateNumericRecords(eventCounts),
    outcome_counts: aggregateNumericRecords(outcomeCounts),
    recent_feedback: newestRecords(feedbackStreams as StreamEntry[][], 20),
    recent_incidents: newestRecords(incidentStreams as StreamEntry[][], 20),
    privacy: {
      raw_citizen_ids_stored: false,
      emails_stored: false,
      gps_stored: false,
      arbitrary_event_payloads_allowed: false,
      stable_pseudonyms_exposed_to_operators: false,
    },
  }
}

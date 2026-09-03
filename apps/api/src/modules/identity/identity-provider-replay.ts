import { createHash } from 'crypto'
import { redis } from '../../lib/redis'
import type { NativeProviderReplayClaim } from './identity-provider-adapter'

const PROVIDER_RE = /^[a-z0-9][a-z0-9_.-]{0,49}$/
const EVENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,190}$/
const MIN_REPLAY_TTL_SECONDS = 60
const MAX_REPLAY_TTL_SECONDS = 24 * 60 * 60

export type NativeReplaySetNxEx = (
  key: string,
  value: string,
  ttlSeconds: number,
) => Promise<'OK' | null>

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

function assertReplayClaim(claim: NativeProviderReplayClaim): NativeProviderReplayClaim {
  const provider = normalizeProvider(claim.provider)
  if (!PROVIDER_RE.test(provider)) throw new Error('INVALID_NATIVE_REPLAY_PROVIDER')
  if (!EVENT_ID_RE.test(claim.event_id)) throw new Error('INVALID_NATIVE_REPLAY_EVENT_ID')
  if (!Number.isInteger(claim.ttl_seconds)
    || claim.ttl_seconds < MIN_REPLAY_TTL_SECONDS
    || claim.ttl_seconds > MAX_REPLAY_TTL_SECONDS) {
    throw new Error('INVALID_NATIVE_REPLAY_TTL')
  }
  return { ...claim, provider }
}

export function buildNativeProviderReplayKey(claimInput: NativeProviderReplayClaim): string {
  const claim = assertReplayClaim(claimInput)
  const digest = createHash('sha256')
    .update(`${claim.provider}\0${claim.event_id}`)
    .digest('hex')
  return `identity:native-replay:v1:${claim.provider}:${digest}`
}

/**
 * Atomic replay claim backed by the shared Redis topology.
 *
 * Provider event ids are hashed before entering Redis keys so opaque vendor
 * references are not copied verbatim into operational keyspace. Any Redis
 * failure is intentionally propagated: identity ingress must fail closed when
 * distributed replay protection is unavailable.
 */
export async function claimNativeProviderReplayWithStore(
  claimInput: NativeProviderReplayClaim,
  setNxEx: NativeReplaySetNxEx,
): Promise<boolean> {
  const claim = assertReplayClaim(claimInput)
  const key = buildNativeProviderReplayKey(claim)
  const result = await setNxEx(key, '1', claim.ttl_seconds)
  return result === 'OK'
}

export async function claimNativeProviderReplay(
  claim: NativeProviderReplayClaim,
): Promise<boolean> {
  return claimNativeProviderReplayWithStore(
    claim,
    async (key, value, ttlSeconds) => redis.set(key, value, 'EX', ttlSeconds, 'NX'),
  )
}

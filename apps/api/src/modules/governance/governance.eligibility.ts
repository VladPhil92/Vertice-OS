import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getOperationalCivicIdentityProviders } from '../identity/identity-proofing-provider-config'
import type { ProposalScope } from './governance.types'

export const GOVERNANCE_ELIGIBILITY_REASON_CODES = [
  'ELIGIBLE_CURRENT_ASSURANCE',
  'ELIGIBLE_FROZEN_ELECTORATE',
  'IDENTITY_ASSURANCE_UNAVAILABLE',
  'IDENTITY_ASSURANCE_REQUIRED',
  'TERRITORY_ASSURANCE_REQUIRED',
  'TERRITORY_ASSURANCE_EXPIRED',
  'TERRITORY_SCOPE_MISMATCH',
  'VOTER_ROLL_UNAVAILABLE',
  'NOT_IN_FROZEN_ELECTORATE',
] as const

export type GovernanceEligibilityReasonCode = typeof GOVERNANCE_ELIGIBILITY_REASON_CODES[number]
export type GovernanceEligibilityAuthority = 'current_assurance' | 'frozen_electorate' | 'none'

type EligibilityRow = {
  proposal_id: string
  scope: ProposalScope
  proposal_territory_code: string | null
  proposal_parent_code: string | null
  proposal_locality_id: number | null
  proposal_neighborhood: string | null
  voting_starts_at: Date | null
  citizen_exists: boolean
  verification_level: number | null
  citizen_territory_code: string | null
  citizen_parent_code: string | null
  citizen_locality_id: number | null
  citizen_neighborhood: string | null
  current_assurance_request_id: string | null
  current_assurance_level: number | null
  current_assurance_status: string | null
  current_assurance_verified_at: Date | null
  current_assurance_expires_at: Date | null
  current_identity_proof_id: string | null
  current_identity_provider: string | null
  current_identity_verified_at: Date | null
  current_identity_expires_at: Date | null
  roll_exists: boolean
  roll_member: boolean
  frozen_at: Date | null
  frozen_identity_proof_id: string | null
  frozen_identity_provider: string | null
  frozen_identity_verified_at: Date | null
  frozen_identity_expires_at: Date | null
  frozen_territory_code: string | null
  frozen_territory_assurance_level: number | null
  frozen_territory_assurance_request_id: string | null
  frozen_territory_verified_at: Date | null
  frozen_territory_assurance_expires_at: Date | null
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function scopeMatches(row: EligibilityRow): boolean {
  if (row.scope === 'national') return true
  if (!row.proposal_territory_code || !row.citizen_territory_code) return false

  if (row.scope === 'city') {
    return row.citizen_territory_code === row.proposal_territory_code
  }
  if (row.scope === 'regional') {
    return row.proposal_parent_code !== null
      && row.citizen_parent_code !== null
      && row.proposal_parent_code === row.citizen_parent_code
  }
  if (row.scope === 'locality') {
    return row.citizen_territory_code === row.proposal_territory_code
      && row.proposal_locality_id !== null
      && row.citizen_locality_id === row.proposal_locality_id
  }
  if (row.scope === 'neighborhood') {
    const localityMatches = row.proposal_locality_id === null
      || row.citizen_locality_id === row.proposal_locality_id
    return row.citizen_territory_code === row.proposal_territory_code
      && localityMatches
      && row.proposal_neighborhood !== null
      && row.citizen_neighborhood === row.proposal_neighborhood
  }
  return false
}

function currentTerritoryAssuranceState(row: EligibilityRow, at: Date) {
  const required = row.scope !== 'national'
  if (!required) {
    return { required: false, satisfied: true, expired: false, scope_match: true }
  }

  const expiresAt = row.current_assurance_expires_at
  const verifiedAt = row.current_assurance_verified_at
  const expired = row.current_assurance_status === 'verified'
    && expiresAt !== null
    && expiresAt.getTime() <= at.getTime()
  const scopeMatch = scopeMatches(row)
  const satisfied = row.current_assurance_level !== null
    && row.current_assurance_level >= 1
    && row.current_assurance_request_id !== null
    && row.current_assurance_status === 'verified'
    && verifiedAt !== null
    && verifiedAt.getTime() <= at.getTime()
    && expiresAt !== null
    && expiresAt.getTime() > at.getTime()
    && scopeMatch

  return { required, satisfied, expired, scope_match: scopeMatch }
}

export async function getGovernanceEligibilityPreflight(
  proposalId: string,
  citizenId: string,
  at: Date = new Date(),
) {
  const operationalProviders = getOperationalCivicIdentityProviders()
  const identityProviderPredicate = operationalProviders.length > 0
    ? Prisma.sql`cip.provider IN (${Prisma.join(operationalProviders)})`
    : Prisma.sql`FALSE`

  const rows = await prisma.$queryRaw<EligibilityRow[]>(Prisma.sql`
    SELECT
      p.id::text AS proposal_id,
      p.scope,
      p.territory_code AS proposal_territory_code,
      proposal_territory.parent_code AS proposal_parent_code,
      p.locality_id AS proposal_locality_id,
      p.neighborhood AS proposal_neighborhood,
      p.voting_starts_at,
      (c.id IS NOT NULL) AS citizen_exists,
      c.verification_level,
      c.territory_code AS citizen_territory_code,
      citizen_territory.parent_code AS citizen_parent_code,
      c.locality_id AS citizen_locality_id,
      c.neighborhood AS citizen_neighborhood,
      c.territory_assurance_request_id::text AS current_assurance_request_id,
      c.territory_assurance_level AS current_assurance_level,
      current_assurance.status AS current_assurance_status,
      current_assurance.verified_at AS current_assurance_verified_at,
      current_assurance.expires_at AS current_assurance_expires_at,
      current_identity.id::text AS current_identity_proof_id,
      current_identity.provider AS current_identity_provider,
      current_identity.verified_at AS current_identity_verified_at,
      current_identity.expires_at AS current_identity_expires_at,
      EXISTS (
        SELECT 1 FROM proposal_voter_roll any_roll
        WHERE any_roll.proposal_id = p.id
      ) AS roll_exists,
      (frozen.citizen_id IS NOT NULL) AS roll_member,
      frozen.frozen_at,
      frozen.identity_proof_id::text AS frozen_identity_proof_id,
      frozen.identity_provider AS frozen_identity_provider,
      frozen.identity_verified_at AS frozen_identity_verified_at,
      frozen.identity_expires_at AS frozen_identity_expires_at,
      frozen.territory_code AS frozen_territory_code,
      frozen.territory_assurance_level AS frozen_territory_assurance_level,
      frozen.territory_assurance_request_id::text AS frozen_territory_assurance_request_id,
      frozen.territory_verified_at AS frozen_territory_verified_at,
      frozen.territory_assurance_expires_at AS frozen_territory_assurance_expires_at
    FROM proposals p
    LEFT JOIN citizens c ON c.id = ${citizenId}::uuid
    LEFT JOIN territories proposal_territory ON proposal_territory.code = p.territory_code
    LEFT JOIN territories citizen_territory ON citizen_territory.code = c.territory_code
    LEFT JOIN territory_assurance_requests current_assurance
      ON current_assurance.id = c.territory_assurance_request_id
      AND current_assurance.citizen_id = c.id
      AND current_assurance.territory_code = c.territory_code
    LEFT JOIN LATERAL (
      SELECT cip.id, cip.provider, cip.verified_at, cip.expires_at
      FROM civic_identity_proofs cip
      WHERE cip.citizen_id = c.id
        AND ${identityProviderPredicate}
        AND cip.status = 'verified'
        AND cip.assurance_level >= 2
        AND cip.verified_at IS NOT NULL
        AND cip.verified_at <= ${at}
        AND cip.revoked_at IS NULL
        AND (cip.expires_at IS NULL OR cip.expires_at > ${at})
      ORDER BY cip.assurance_level DESC, cip.verified_at DESC, cip.id
      LIMIT 1
    ) current_identity ON TRUE
    LEFT JOIN proposal_voter_roll frozen
      ON frozen.proposal_id = p.id
      AND frozen.citizen_id = c.id
    WHERE p.id = ${proposalId}::uuid
  `)

  const row = rows[0]
  if (!row) throw makeError('Propuesta no encontrada', 404, 'PROPOSAL_NOT_FOUND')

  const frozen = row.voting_starts_at !== null
  if (frozen) {
    const eligible = row.roll_exists && row.roll_member
    const reasonCode: GovernanceEligibilityReasonCode = !row.roll_exists
      ? 'VOTER_ROLL_UNAVAILABLE'
      : row.roll_member
        ? 'ELIGIBLE_FROZEN_ELECTORATE'
        : 'NOT_IN_FROZEN_ELECTORATE'

    return {
      proposal_id: row.proposal_id,
      citizen_id: citizenId,
      scope: row.scope,
      eligible,
      authority: (eligible ? 'frozen_electorate' : 'none') as GovernanceEligibilityAuthority,
      reason_code: reasonCode,
      evaluated_at: at,
      identity_assurance: {
        required: true,
        satisfied: row.roll_member,
        proof_id: row.frozen_identity_proof_id,
        provider: row.frozen_identity_provider,
        verified_at: row.frozen_identity_verified_at,
        expires_at: row.frozen_identity_expires_at,
      },
      territory_assurance: {
        required: row.scope !== 'national',
        satisfied: row.scope === 'national' ? true : row.roll_member,
        request_id: row.frozen_territory_assurance_request_id,
        territory_code: row.frozen_territory_code,
        assurance_level: row.frozen_territory_assurance_level,
        verified_at: row.frozen_territory_verified_at,
        expires_at: row.frozen_territory_assurance_expires_at,
      },
      frozen_electorate: {
        required: true,
        available: row.roll_exists,
        member: row.roll_member,
        frozen_at: row.frozen_at,
        provenance_available: row.roll_member
          && row.frozen_identity_proof_id !== null
          && (row.scope === 'national' || row.frozen_territory_assurance_request_id !== null),
      },
    }
  }

  const identitySatisfied = row.current_identity_proof_id !== null
  const territory = currentTerritoryAssuranceState(row, at)
  let eligible = false
  let reasonCode: GovernanceEligibilityReasonCode

  if (operationalProviders.length === 0) {
    reasonCode = 'IDENTITY_ASSURANCE_UNAVAILABLE'
  } else if (!identitySatisfied) {
    reasonCode = 'IDENTITY_ASSURANCE_REQUIRED'
  } else if (territory.required && territory.expired) {
    reasonCode = 'TERRITORY_ASSURANCE_EXPIRED'
  } else if (territory.required && row.current_assurance_request_id === null) {
    reasonCode = 'TERRITORY_ASSURANCE_REQUIRED'
  } else if (territory.required && !territory.scope_match) {
    reasonCode = 'TERRITORY_SCOPE_MISMATCH'
  } else if (territory.required && !territory.satisfied) {
    reasonCode = 'TERRITORY_ASSURANCE_REQUIRED'
  } else {
    eligible = true
    reasonCode = 'ELIGIBLE_CURRENT_ASSURANCE'
  }

  return {
    proposal_id: row.proposal_id,
    citizen_id: citizenId,
    scope: row.scope,
    eligible,
    authority: (eligible ? 'current_assurance' : 'none') as GovernanceEligibilityAuthority,
    reason_code: reasonCode,
    evaluated_at: at,
    identity_assurance: {
      required: true,
      satisfied: identitySatisfied,
      proof_id: row.current_identity_proof_id,
      provider: row.current_identity_provider,
      verified_at: row.current_identity_verified_at,
      expires_at: row.current_identity_expires_at,
    },
    territory_assurance: {
      required: territory.required,
      satisfied: territory.satisfied,
      expired: territory.expired,
      scope_match: territory.scope_match,
      request_id: row.current_assurance_request_id,
      territory_code: row.citizen_territory_code,
      assurance_level: row.current_assurance_level ?? 0,
      verified_at: row.current_assurance_verified_at,
      expires_at: row.current_assurance_expires_at,
    },
    frozen_electorate: {
      required: false,
      available: false,
      member: false,
      frozen_at: null,
      provenance_available: false,
    },
  }
}

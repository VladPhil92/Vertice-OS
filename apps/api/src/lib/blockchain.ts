import { JsonRpcProvider, Wallet, Contract, isAddress, keccak256, toUtf8Bytes } from 'ethers'
import { config } from '../config'
import { logger } from './logger'
import { getDidCommitmentPepper } from './feature-secrets'

const CIVIC_SBT_ABI = [
  {
    name: 'mintBadge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient',     type: 'address' },
      { name: 'didCommitment', type: 'bytes32' },
      { name: 'badgeType',     type: 'uint8'   },
      { name: 'uri',           type: 'string'  },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'hasBadge',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'didCommitment', type: 'bytes32' },
      { name: 'badgeType',     type: 'uint8'   },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/**
 * Deriva el compromiso que se escribe on-chain sin exponer el DID en claro.
 * El pepper no tiene fallback seguro: si falta, la capacidad blockchain falla
 * con 503 en este límite de funcionalidad, sin derribar el resto de la API.
 */
export function deriveDIDCommitment(citizenDID: string): string {
  const pepper = getDidCommitmentPepper()
  return keccak256(toUtf8Bytes(`${pepper}:${citizenDID}`))
}

export const BadgeType = {
  CITIZEN_VERIFIED:       0,
  PROPOSAL_APPROVED:      1,
  TERRITORY_CHAMPION:     2,
  DELEGATE:               3,
  GOVERNANCE_PARTICIPANT: 4,
} as const

export type BadgeTypeValue = typeof BadgeType[keyof typeof BadgeType]

const VOTING_REGISTRY_ABI = [
  {
    name: 'recordVoting',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId',      type: 'bytes32'  },
      { name: 'proposalHash',    type: 'bytes32'  },
      { name: 'totalVotes',      type: 'uint256'  },
      { name: 'approveWeighted', type: 'uint256'  },
      { name: 'rejectWeighted',  type: 'uint256'  },
      { name: 'abstainWeighted', type: 'uint256'  },
      { name: 'approved',        type: 'bool'     },
      { name: 'quorumReached',   type: 'bool'     },
      { name: 'ipfsResultsURI',  type: 'string'   },
    ],
    outputs: [],
  },
  {
    name: 'isRecorded',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

let _contract: Contract | null = null

function getContract(): Contract | null {
  if (_contract) return _contract

  const { POLYGON_RPC_URL, POLYGON_PRIVATE_KEY, CIVIC_SBT_ADDRESS } = config
  if (!POLYGON_RPC_URL || !POLYGON_PRIVATE_KEY || !CIVIC_SBT_ADDRESS) return null

  const provider = new JsonRpcProvider(POLYGON_RPC_URL)
  const wallet = new Wallet(POLYGON_PRIVATE_KEY, provider)
  _contract = new Contract(CIVIC_SBT_ADDRESS, CIVIC_SBT_ABI, wallet)
  return _contract
}

let _votingRegistry: Contract | null = null

function getVotingRegistry(): Contract | null {
  if (_votingRegistry) return _votingRegistry

  const { POLYGON_RPC_URL, POLYGON_PRIVATE_KEY, VOTING_REGISTRY_ADDRESS } = config
  if (!POLYGON_RPC_URL || !POLYGON_PRIVATE_KEY || !VOTING_REGISTRY_ADDRESS) return null

  const provider = new JsonRpcProvider(POLYGON_RPC_URL)
  const wallet = new Wallet(POLYGON_PRIVATE_KEY, provider)
  _votingRegistry = new Contract(VOTING_REGISTRY_ADDRESS, VOTING_REGISTRY_ABI, wallet)
  return _votingRegistry
}

export function isBlockchainConfigured(): boolean {
  return !!(
    config.POLYGON_RPC_URL &&
    config.POLYGON_PRIVATE_KEY &&
    config.CIVIC_SBT_ADDRESS &&
    config.DID_COMMITMENT_PEPPER
  )
}

export function isValidWalletAddress(address: string): boolean {
  return isAddress(address)
}

export async function checkHasBadge(did: string, badgeType: BadgeTypeValue): Promise<boolean> {
  const contract = getContract()
  if (!contract) return false
  try {
    return await contract.hasBadge(deriveDIDCommitment(did), badgeType) as boolean
  } catch (err) {
    const maybeFeatureError = err as { statusCode?: number }
    if (maybeFeatureError.statusCode === 503) throw err
    logger.error('[blockchain] hasBadge error', err)
    return false
  }
}

export async function mintCitizenBadge(
  recipientAddress: string,
  citizenDID: string,
  tokenURI: string,
): Promise<string | null> {
  const contract = getContract()
  if (!contract) return null

  const commitment = deriveDIDCommitment(citizenDID)
  const alreadyHas = await contract.hasBadge(commitment, BadgeType.CITIZEN_VERIFIED)
  if (alreadyHas) {
    logger.info(`[blockchain] ${commitment} ya tiene CITIZEN_VERIFIED badge — omitiendo mint`)
    return null
  }

  const tx = await contract.mintBadge(
    recipientAddress,
    commitment,
    BadgeType.CITIZEN_VERIFIED,
    tokenURI,
  )
  const receipt = await tx.wait()

  const tokenId = receipt?.logs?.[0] ? String((receipt.logs[0] as { args?: bigint[] }).args?.[0] ?? 0n) : '0'
  logger.info(`[blockchain] CITIZEN_VERIFIED minted → tokenId=${tokenId} tx=${receipt?.hash ?? 'unknown'}`)
  return tokenId
}

export function buildCitizenBadgeURI(citizenDID: string, level: number): string {
  if (!isBlockchainConfigured()) {
    return `did:vertice:badge:citizen_verified:${encodeURIComponent(citizenDID)}`
  }
  const commitment = deriveDIDCommitment(citizenDID)
  return `${config.IPFS_GATEWAY}/QmVerticeCitizenBadge?c=${commitment}&level=${level}`
}

export async function recordProposalVoting(
  proposalUUID: string,
  contentHash: string,
  totalVotes: number,
  approveW: number,
  rejectW: number,
  abstainW: number,
  approved: boolean,
  quorumReached: boolean,
  ipfsURI: string,
): Promise<string | null> {
  const contract = getVotingRegistry()
  if (!contract) return null

  const proposalId = keccak256(toUtf8Bytes(proposalUUID))
  const proposalHash = contentHash as `0x${string}`

  const alreadyRecorded = await contract.isRecorded(proposalId) as boolean
  if (alreadyRecorded) {
    logger.info(`[blockchain] proposal ${proposalUUID} ya está registrado en VotingRegistry`)
    return null
  }

  const tx = await contract.recordVoting(
    proposalId,
    proposalHash,
    BigInt(totalVotes),
    BigInt(Math.round(approveW * 1_000_000)),
    BigInt(Math.round(rejectW * 1_000_000)),
    BigInt(Math.round(abstainW * 1_000_000)),
    approved,
    quorumReached,
    ipfsURI,
  )
  const receipt = await tx.wait()
  const hash = receipt?.hash ?? 'unknown'
  logger.info(`[blockchain] VotingRegistry recorded → proposal=${proposalUUID} tx=${hash}`)
  return hash
}

export function buildProposalContentHash(title: string, description: string): string {
  return keccak256(toUtf8Bytes(`${title}::${description}`))
}

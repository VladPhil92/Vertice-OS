import { JsonRpcProvider, Wallet, Contract, isAddress, keccak256, toUtf8Bytes } from 'ethers'
import { config } from '../config'

// ── ABI mínimo de CivicSBT (solo las funciones que usa el backend) ────────────

const CIVIC_SBT_ABI = [
  {
    name: 'mintBadge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient',  type: 'address' },
      { name: 'citizenDID', type: 'string'  },
      { name: 'badgeType',  type: 'uint8'   },
      { name: 'uri',        type: 'string'  },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'hasBadge',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'did',       type: 'string' },
      { name: 'badgeType', type: 'uint8'  },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// BadgeType enum — debe coincidir con CivicSBT.sol
export const BadgeType = {
  CITIZEN_VERIFIED:       0,
  PROPOSAL_APPROVED:      1,
  TERRITORY_CHAMPION:     2,
  DELEGATE:               3,
  GOVERNANCE_PARTICIPANT: 4,
} as const

export type BadgeTypeValue = typeof BadgeType[keyof typeof BadgeType]

// ── ABI mínimo de VotingRegistry ─────────────────────────────────────────────

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

// ── Singleton del contrato CivicSBT ───────────────────────────────────────────

let _contract: Contract | null = null

function getContract(): Contract | null {
  if (_contract) return _contract

  const { POLYGON_RPC_URL, POLYGON_PRIVATE_KEY, CIVIC_SBT_ADDRESS } = config

  if (!POLYGON_RPC_URL || !POLYGON_PRIVATE_KEY || !CIVIC_SBT_ADDRESS) {
    return null
  }

  const provider = new JsonRpcProvider(POLYGON_RPC_URL)
  const wallet   = new Wallet(POLYGON_PRIVATE_KEY, provider)
  _contract = new Contract(CIVIC_SBT_ADDRESS, CIVIC_SBT_ABI, wallet)
  return _contract
}

// ── Singleton del contrato VotingRegistry ─────────────────────────────────────

let _votingRegistry: Contract | null = null

function getVotingRegistry(): Contract | null {
  if (_votingRegistry) return _votingRegistry

  const { POLYGON_RPC_URL, POLYGON_PRIVATE_KEY, VOTING_REGISTRY_ADDRESS } = config

  if (!POLYGON_RPC_URL || !POLYGON_PRIVATE_KEY || !VOTING_REGISTRY_ADDRESS) {
    return null
  }

  const provider = new JsonRpcProvider(POLYGON_RPC_URL)
  const wallet   = new Wallet(POLYGON_PRIVATE_KEY, provider)
  _votingRegistry = new Contract(VOTING_REGISTRY_ADDRESS, VOTING_REGISTRY_ABI, wallet)
  return _votingRegistry
}

// ── Funciones públicas ────────────────────────────────────────────────────────

export function isBlockchainConfigured(): boolean {
  return !!(config.POLYGON_RPC_URL && config.POLYGON_PRIVATE_KEY && config.CIVIC_SBT_ADDRESS)
}

export function isValidWalletAddress(address: string): boolean {
  return isAddress(address)
}

/**
 * Comprueba on-chain si un DID ya tiene un badge de cierto tipo.
 * Devuelve false si la blockchain no está configurada.
 */
export async function checkHasBadge(did: string, badgeType: BadgeTypeValue): Promise<boolean> {
  const contract = getContract()
  if (!contract) return false
  try {
    return await contract.hasBadge(did, badgeType) as boolean
  } catch (err) {
    console.error('[blockchain] hasBadge error:', err)
    return false
  }
}

/**
 * Emite un CivicSBT CITIZEN_VERIFIED a la wallet del ciudadano.
 * Fire-and-forget: no lanza excepciones — registra errores en consola.
 * Devuelve el tokenId como string, o null si el minting falló/no está configurado.
 */
export async function mintCitizenBadge(
  recipientAddress: string,
  citizenDID: string,
  tokenURI: string,
): Promise<string | null> {
  const contract = getContract()
  if (!contract) return null

  try {
    // Verificar idempotencia on-chain antes de gastar gas
    const alreadyHas = await contract.hasBadge(citizenDID, BadgeType.CITIZEN_VERIFIED)
    if (alreadyHas) {
      console.info(`[blockchain] ${citizenDID} ya tiene CITIZEN_VERIFIED badge — omitiendo mint`)
      return null
    }

    const tx = await contract.mintBadge(
      recipientAddress,
      citizenDID,
      BadgeType.CITIZEN_VERIFIED,
      tokenURI,
    )
    const receipt = await tx.wait()

    const tokenId = receipt?.logs?.[0] ? String((receipt.logs[0] as { args?: bigint[] }).args?.[0] ?? 0n) : '0'
    console.info(`[blockchain] CITIZEN_VERIFIED minted → tokenId=${tokenId} tx=${receipt?.hash ?? 'unknown'}`)
    return tokenId
  } catch (err) {
    console.error('[blockchain] mintBadge error:', err)
    return null
  }
}

/**
 * Construye el tokenURI de metadata para el badge de identidad cívica.
 * En producción debería apuntar a un JSON en IPFS; en dev usa una URL local.
 */
export function buildCitizenBadgeURI(citizenDID: string, level: number): string {
  if (!isBlockchainConfigured()) {
    return `did:vertice:badge:citizen_verified:${encodeURIComponent(citizenDID)}`
  }
  // En Fase I usamos el gateway IPFS configurado con un hash placeholder.
  // En Fase II se genera el JSON real y se sube a Pinecone/IPFS antes del mint.
  return `${config.IPFS_GATEWAY}/QmVerticeCitizenBadge?did=${encodeURIComponent(citizenDID)}&level=${level}`
}

// ── VotingRegistry ────────────────────────────────────────────────────────────

/**
 * Registra el resultado de una votación on-chain en VotingRegistry.
 * Fire-and-forget: no lanza excepciones — registra errores en consola.
 * Devuelve el tx hash, o null si el registro falló/no está configurado.
 *
 * @param proposalUUID  UUID de la propuesta (se convierte a bytes32 via keccak256)
 * @param contentHash   keccak256 de title+description para integridad
 * @param totalVotes    Número total de votos emitidos
 * @param approveW      Votos ponderados a favor (float, se escala ×1_000_000)
 * @param rejectW       Votos ponderados en contra
 * @param abstainW      Abstenciones ponderadas
 * @param approved      true si la propuesta fue aprobada
 * @param quorumReached true si se alcanzó el quórum mínimo
 * @param ipfsURI       URI del JSON de resultados en IPFS (placeholder en Fase I)
 */
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

  const proposalId   = keccak256(toUtf8Bytes(proposalUUID))
  const proposalHash = contentHash as `0x${string}`

  try {
    // Idempotencia: no re-registrar si ya está grabado
    const alreadyRecorded = await contract.isRecorded(proposalId) as boolean
    if (alreadyRecorded) {
      console.info(`[blockchain] proposal ${proposalUUID} ya está registrado en VotingRegistry`)
      return null
    }

    // Weighted votes son floats (e.g. 3.5) — escalar ×1_000_000 para uint256
    const tx = await contract.recordVoting(
      proposalId,
      proposalHash,
      BigInt(totalVotes),
      BigInt(Math.round(approveW * 1_000_000)),
      BigInt(Math.round(rejectW  * 1_000_000)),
      BigInt(Math.round(abstainW * 1_000_000)),
      approved,
      quorumReached,
      ipfsURI,
    )
    const receipt = await tx.wait()
    const hash = receipt?.hash ?? 'unknown'
    console.info(`[blockchain] VotingRegistry recorded → proposal=${proposalUUID} tx=${hash}`)
    return hash
  } catch (err) {
    console.error('[blockchain] recordVoting error:', err)
    return null
  }
}

/**
 * Construye el bytes32 hash del contenido de una propuesta para VotingRegistry.
 * Determinístico dado el mismo título + descripción.
 */
export function buildProposalContentHash(title: string, description: string): string {
  return keccak256(toUtf8Bytes(`${title}::${description}`))
}

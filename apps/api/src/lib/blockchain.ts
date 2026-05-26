import { JsonRpcProvider, Wallet, Contract, isAddress } from 'ethers'
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

// ── Singleton del contrato ────────────────────────────────────────────────────

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

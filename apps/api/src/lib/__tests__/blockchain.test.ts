// Mocks must be declared before any import from the module under test

jest.mock('ethers', () => {
  const mockHasBadge  = jest.fn()
  const mockMintBadge = jest.fn()
  const mockIsRecorded   = jest.fn()
  const mockRecordVoting = jest.fn()

  const MockContract = jest.fn().mockImplementation(() => ({
    hasBadge:      mockHasBadge,
    mintBadge:     mockMintBadge,
    isRecorded:    mockIsRecorded,
    recordVoting:  mockRecordVoting,
  }))

  return {
    JsonRpcProvider: jest.fn(),
    Wallet:          jest.fn(),
    Contract:        MockContract,
    isAddress:       jest.fn((addr: string) => addr.startsWith('0x') && addr.length === 42),
    // Hash real (no keccak, pero determinista y dependiente de la entrada) para
    // que las propiedades del compromiso puedan comprobarse de verdad.
    keccak256:       jest.fn((bytes: Uint8Array) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      '0x' + require('node:crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex')),
    toUtf8Bytes:     jest.fn((s: string) => Buffer.from(s, 'utf8')),
    __mocks: { mockHasBadge, mockMintBadge, mockIsRecorded, mockRecordVoting },
  }
})

// The module reads config at import time — ensure env vars are set (setup.ts does this)
import { isBlockchainConfigured, isValidWalletAddress, BadgeType, deriveDIDCommitment, buildCitizenBadgeURI } from '../blockchain'

describe('isBlockchainConfigured', () => {
  it('returns false when env vars are absent', () => {
    // POLYGON_RPC_URL / POLYGON_PRIVATE_KEY / CIVIC_SBT_ADDRESS are not set in test env
    expect(isBlockchainConfigured()).toBe(false)
  })
})

describe('isValidWalletAddress', () => {
  it('returns true for a 42-char 0x address', () => {
    expect(isValidWalletAddress('0x' + 'a'.repeat(40))).toBe(true)
  })

  it('returns false for a non-address string', () => {
    expect(isValidWalletAddress('not-an-address')).toBe(false)
  })
})

describe('BadgeType constants', () => {
  it('CITIZEN_VERIFIED is 0', () => expect(BadgeType.CITIZEN_VERIFIED).toBe(0))
  it('PROPOSAL_APPROVED is 1',  () => expect(BadgeType.PROPOSAL_APPROVED).toBe(1))
})

// ── deriveDIDCommitment ───────────────────────────────────────────────────────
// El contrato almacena keccak256(pepper:did) en lugar del DID. Sin esto, la
// cadena expondría un vínculo público y permanente entre wallet, identidad
// cívica y actividad política.

describe('deriveDIDCommitment', () => {
  const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'

  it('nunca devuelve el DID en claro', () => {
    const commitment = deriveDIDCommitment(DID)
    expect(commitment).not.toContain(DID)
    expect(commitment).not.toContain('550e8400')
    expect(commitment).toMatch(/^0x[0-9a-f]+$/)
  })

  it('es determinista — la prevención de duplicados on-chain depende de ello', () => {
    expect(deriveDIDCommitment(DID)).toBe(deriveDIDCommitment(DID))
  })

  it('distingue DIDs distintos', () => {
    const other = 'did:vertice:660e8400-e29b-41d4-a716-446655440001'
    expect(deriveDIDCommitment(DID)).not.toBe(deriveDIDCommitment(other))
  })

  it('falla si falta el pepper en vez de emitir un compromiso débil', () => {
    const original = process.env.DID_COMMITMENT_PEPPER
    jest.resetModules()
    delete process.env.DID_COMMITMENT_PEPPER
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../blockchain')
      expect(() => fresh.deriveDIDCommitment(DID)).toThrow(/DID_COMMITMENT_PEPPER/)
    } finally {
      process.env.DID_COMMITMENT_PEPPER = original
      jest.resetModules()
    }
  })
})

describe('buildCitizenBadgeURI', () => {
  const DID = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'

  it('no filtra el DID cuando el URI va on-chain', () => {
    // El tokenURI se almacena en el contrato y es públicamente legible, así
    // que solo importa la ruta con blockchain configurada. Se carga el módulo
    // con esas variables presentes para ejercitarla de verdad.
    jest.resetModules()
    const saved = {
      rpc:  process.env.POLYGON_RPC_URL,
      key:  process.env.POLYGON_PRIVATE_KEY,
      addr: process.env.CIVIC_SBT_ADDRESS,
    }
    process.env.POLYGON_RPC_URL     = 'https://rpc-amoy.polygon.technology'
    process.env.POLYGON_PRIVATE_KEY = '0x' + '1'.repeat(64)
    process.env.CIVIC_SBT_ADDRESS   = '0x' + 'a'.repeat(40)

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../blockchain')
      expect(fresh.isBlockchainConfigured()).toBe(true)

      const uri = fresh.buildCitizenBadgeURI(DID, 1) as string
      expect(uri).not.toContain('550e8400')
      expect(uri).not.toContain('did:vertice')
      expect(uri).toContain(fresh.deriveDIDCommitment(DID))
    } finally {
      process.env.POLYGON_RPC_URL     = saved.rpc
      process.env.POLYGON_PRIVATE_KEY = saved.key
      process.env.CIVIC_SBT_ADDRESS   = saved.addr
      jest.resetModules()
    }
  })

  it('usa un placeholder local cuando no hay blockchain — nunca llega a la cadena', () => {
    expect(isBlockchainConfigured()).toBe(false)
    expect(buildCitizenBadgeURI(DID, 1)).toContain('did:vertice:badge')
  })
})

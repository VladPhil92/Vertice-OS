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
    keccak256:       jest.fn().mockReturnValue('0xdeadbeef'),
    toUtf8Bytes:     jest.fn().mockReturnValue(new Uint8Array()),
    __mocks: { mockHasBadge, mockMintBadge, mockIsRecorded, mockRecordVoting },
  }
})

// The module reads config at import time — ensure env vars are set (setup.ts does this)
import { isBlockchainConfigured, isValidWalletAddress, BadgeType } from '../blockchain'

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

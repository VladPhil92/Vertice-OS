const mockConfig = {
  NODE_ENV: 'production',
  JWT_SECRET: 'jwt-secret-with-at-least-thirty-two-characters',
  VOTE_NULLIFIER_SECRET: undefined as string | undefined,
  IDENTITY_PEPPER: undefined as string | undefined,
  AI_SERVICE_SECRET: '',
  CIVIC_IDENTITY_ASSURANCE_PROVIDERS: [] as string[],
  POLYGON_RPC_URL: undefined as string | undefined,
  POLYGON_PRIVATE_KEY: undefined as string | undefined,
  CIVIC_SBT_ADDRESS: undefined as string | undefined,
  VOTING_REGISTRY_ADDRESS: undefined as string | undefined,
  DID_COMMITMENT_PEPPER: undefined as string | undefined,
}

jest.mock('../../config', () => ({ config: mockConfig }))

import {
  getDidCommitmentPepper,
  getFeatureCapabilities,
  getVoteNullifierSecret,
} from '../feature-secrets'

beforeEach(() => {
  mockConfig.VOTE_NULLIFIER_SECRET = undefined
  mockConfig.IDENTITY_PEPPER = undefined
  mockConfig.AI_SERVICE_SECRET = ''
  mockConfig.CIVIC_IDENTITY_ASSURANCE_PROVIDERS = []
  mockConfig.POLYGON_RPC_URL = undefined
  mockConfig.POLYGON_PRIVATE_KEY = undefined
  mockConfig.CIVIC_SBT_ADDRESS = undefined
  mockConfig.VOTING_REGISTRY_ADDRESS = undefined
  mockConfig.DID_COMMITMENT_PEPPER = undefined
})

describe('feature-scoped production configuration', () => {
  it('fails voting closed instead of reusing JWT_SECRET', () => {
    expect(() => getVoteNullifierSecret()).toThrow(
      expect.objectContaining({
        statusCode: 503,
        code: 'VOTING_CRYPTO_UNAVAILABLE',
      }),
    )
  })

  it('fails CivicSBT commitment generation closed without a pepper', () => {
    expect(() => getDidCommitmentPepper()).toThrow(
      expect.objectContaining({
        statusCode: 503,
        code: 'BLOCKCHAIN_CRYPTO_UNAVAILABLE',
      }),
    )
  })

  it('reports deliberately disabled optional features without marking them misconfigured', () => {
    expect(getFeatureCapabilities()).toEqual({
      civic_ai: 'disabled',
      voting_crypto: 'disabled',
      identity_crypto: 'disabled',
      civic_identity_assurance: 'disabled',
      civic_sbt: 'disabled',
      voting_registry: 'disabled',
    })
  })

  it('reports a partially configured CivicSBT capability as misconfigured', () => {
    mockConfig.CIVIC_SBT_ADDRESS = '0x1111111111111111111111111111111111111111'
    mockConfig.POLYGON_RPC_URL = 'https://polygon.example.test'
    mockConfig.POLYGON_PRIVATE_KEY = '0xprivate'

    expect(getFeatureCapabilities().civic_sbt).toBe('misconfigured')
  })

  it('reports blockchain capabilities ready only when their required configuration is complete', () => {
    mockConfig.CIVIC_SBT_ADDRESS = '0x1111111111111111111111111111111111111111'
    mockConfig.VOTING_REGISTRY_ADDRESS = '0x2222222222222222222222222222222222222222'
    mockConfig.POLYGON_RPC_URL = 'https://polygon.example.test'
    mockConfig.POLYGON_PRIVATE_KEY = '0xprivate'
    mockConfig.DID_COMMITMENT_PEPPER = 'pepper-with-at-least-thirty-two-characters'

    const capabilities = getFeatureCapabilities()
    expect(capabilities.civic_sbt).toBe('ready')
    expect(capabilities.voting_registry).toBe('ready')
  })
})

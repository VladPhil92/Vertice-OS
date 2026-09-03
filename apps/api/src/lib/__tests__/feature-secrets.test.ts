import { config } from '../../config'
import {
  getDidCommitmentPepper,
  getFeatureCapabilities,
  getVoteNullifierSecret,
} from '../feature-secrets'

type MutableConfig = {
  NODE_ENV: 'development' | 'production' | 'test'
  JWT_SECRET: string
  VOTE_NULLIFIER_SECRET?: string
  IDENTITY_PEPPER?: string
  AI_SERVICE_SECRET: string
  CTG_ONE_FEDERATION_SECRET?: string
  CIVIC_IDENTITY_ASSURANCE_PROVIDERS: string[]
  POLYGON_RPC_URL?: string
  POLYGON_PRIVATE_KEY?: string
  CIVIC_SBT_ADDRESS?: string
  VOTING_REGISTRY_ADDRESS?: string
  DID_COMMITMENT_PEPPER?: string
}

const mutableConfig = config as unknown as MutableConfig
const original = {
  NODE_ENV: mutableConfig.NODE_ENV,
  JWT_SECRET: mutableConfig.JWT_SECRET,
  VOTE_NULLIFIER_SECRET: mutableConfig.VOTE_NULLIFIER_SECRET,
  IDENTITY_PEPPER: mutableConfig.IDENTITY_PEPPER,
  AI_SERVICE_SECRET: mutableConfig.AI_SERVICE_SECRET,
  CTG_ONE_FEDERATION_SECRET: mutableConfig.CTG_ONE_FEDERATION_SECRET,
  CIVIC_IDENTITY_ASSURANCE_PROVIDERS: [...mutableConfig.CIVIC_IDENTITY_ASSURANCE_PROVIDERS],
  POLYGON_RPC_URL: mutableConfig.POLYGON_RPC_URL,
  POLYGON_PRIVATE_KEY: mutableConfig.POLYGON_PRIVATE_KEY,
  CIVIC_SBT_ADDRESS: mutableConfig.CIVIC_SBT_ADDRESS,
  VOTING_REGISTRY_ADDRESS: mutableConfig.VOTING_REGISTRY_ADDRESS,
  DID_COMMITMENT_PEPPER: mutableConfig.DID_COMMITMENT_PEPPER,
}

beforeEach(() => {
  mutableConfig.NODE_ENV = 'production'
  mutableConfig.JWT_SECRET = 'jwt-secret-with-at-least-thirty-two-characters'
  mutableConfig.VOTE_NULLIFIER_SECRET = undefined
  mutableConfig.IDENTITY_PEPPER = undefined
  mutableConfig.AI_SERVICE_SECRET = ''
  mutableConfig.CTG_ONE_FEDERATION_SECRET = undefined
  mutableConfig.CIVIC_IDENTITY_ASSURANCE_PROVIDERS = []
  mutableConfig.POLYGON_RPC_URL = undefined
  mutableConfig.POLYGON_PRIVATE_KEY = undefined
  mutableConfig.CIVIC_SBT_ADDRESS = undefined
  mutableConfig.VOTING_REGISTRY_ADDRESS = undefined
  mutableConfig.DID_COMMITMENT_PEPPER = undefined
})

afterAll(() => {
  Object.assign(mutableConfig, original)
})

function expectUnavailable(work: () => unknown, code: string): void {
  try {
    work()
    throw new Error(`Expected ${code}`)
  } catch (error) {
    expect(error).toMatchObject({ statusCode: 503, code })
  }
}

describe('feature-scoped production configuration', () => {
  it('fails voting closed instead of reusing JWT_SECRET', () => {
    expectUnavailable(getVoteNullifierSecret, 'VOTING_CRYPTO_UNAVAILABLE')
  })

  it('fails CivicSBT commitment generation closed without a pepper', () => {
    expectUnavailable(getDidCommitmentPepper, 'BLOCKCHAIN_CRYPTO_UNAVAILABLE')
  })

  it('reports deliberately disabled optional features without marking them misconfigured', () => {
    expect(getFeatureCapabilities()).toEqual({
      civic_ai: 'disabled',
      voting_crypto: 'disabled',
      identity_crypto: 'disabled',
      ctg_one_federation: 'disabled',
      civic_identity_assurance: 'disabled',
      civic_sbt: 'disabled',
      voting_registry: 'disabled',
    })
  })

  it('reports CTG One federation ready only when its shared secret is configured', () => {
    mutableConfig.CTG_ONE_FEDERATION_SECRET = 'federation-secret-with-at-least-thirty-two-characters'

    expect(getFeatureCapabilities().ctg_one_federation).toBe('ready')
  })

  it('reports a partially configured CivicSBT capability as misconfigured', () => {
    mutableConfig.CIVIC_SBT_ADDRESS = '0x1111111111111111111111111111111111111111'
    mutableConfig.POLYGON_RPC_URL = 'https://polygon.example.test'
    mutableConfig.POLYGON_PRIVATE_KEY = 'test-private-key'

    expect(getFeatureCapabilities().civic_sbt).toBe('misconfigured')
  })

  it('reports blockchain capabilities ready only when their required configuration is complete', () => {
    mutableConfig.CIVIC_SBT_ADDRESS = '0x1111111111111111111111111111111111111111'
    mutableConfig.VOTING_REGISTRY_ADDRESS = '0x2222222222222222222222222222222222222222'
    mutableConfig.POLYGON_RPC_URL = 'https://polygon.example.test'
    mutableConfig.POLYGON_PRIVATE_KEY = 'test-private-key'
    mutableConfig.DID_COMMITMENT_PEPPER = 'pepper-with-at-least-thirty-two-characters'

    const capabilities = getFeatureCapabilities()
    expect(capabilities.civic_sbt).toBe('ready')
    expect(capabilities.voting_registry).toBe('ready')
  })
})
import { config } from '../../../config'
import {
  getActivatedCivicIdentityProviders,
  getCivicIdentityProviderActivationState,
  getCivicIdentityProofingIngressState,
  isActivatedCivicIdentityProvider,
} from '../identity-provider-registry'

const savedNodeEnv = config.NODE_ENV
const savedProviders = [...config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS]
const savedKeys = config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON
const VALID_KEYS = JSON.stringify({
  trusted_kyc: { 'test-key': 'test-proofing-provider-key-32-characters!!' },
})

function replaceProviders(...providers: string[]): void {
  config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(
    0,
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length,
    ...providers,
  )
}

afterEach(() => {
  config.NODE_ENV = savedNodeEnv
  replaceProviders(...savedProviders)
  config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = savedKeys
})

describe('civic identity provider activation registry', () => {
  it('activates the synthetic adapter in test runtime only with provider-scoped keys', () => {
    config.NODE_ENV = 'test'
    replaceProviders('trusted_kyc')
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = VALID_KEYS

    expect(getActivatedCivicIdentityProviders()).toEqual(['trusted_kyc'])
    expect(isActivatedCivicIdentityProvider(' Trusted_KYC ')).toBe(true)
    expect(getCivicIdentityProviderActivationState()).toBe('ready')
    expect(getCivicIdentityProofingIngressState()).toBe('ready')
  })

  it('fails closed when configuration names a provider without a compiled adapter', () => {
    config.NODE_ENV = 'test'
    replaceProviders('unregistered_provider')
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
      unregistered_provider: { 'test-key': 'test-proofing-provider-key-32-characters!!' },
    })

    expect(getActivatedCivicIdentityProviders()).toEqual([])
    expect(isActivatedCivicIdentityProvider('unregistered_provider')).toBe(false)
    expect(getCivicIdentityProviderActivationState()).toBe('misconfigured')
  })

  it('never permits the synthetic adapter in production even with valid key configuration', () => {
    config.NODE_ENV = 'production'
    replaceProviders('trusted_kyc')
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = VALID_KEYS

    expect(getActivatedCivicIdentityProviders()).toEqual([])
    expect(isActivatedCivicIdentityProvider('trusted_kyc')).toBe(false)
    expect(getCivicIdentityProviderActivationState()).toBe('misconfigured')
  })

  it('marks a configured provider without ingress keys as misconfigured', () => {
    config.NODE_ENV = 'test'
    replaceProviders('trusted_kyc')
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = ''

    expect(getActivatedCivicIdentityProviders()).toEqual([])
    expect(getCivicIdentityProviderActivationState()).toBe('misconfigured')
    expect(getCivicIdentityProofingIngressState()).toBe('misconfigured')
  })

  it('fails closed on invalid feature-scoped key JSON', () => {
    config.NODE_ENV = 'test'
    replaceProviders('trusted_kyc')
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = '{invalid-json'

    expect(getActivatedCivicIdentityProviders()).toEqual([])
    expect(getCivicIdentityProviderActivationState()).toBe('misconfigured')
  })

  it('reports proofing disabled when neither provider nor key registry is configured', () => {
    replaceProviders()
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = ''

    expect(getCivicIdentityProviderActivationState()).toBe('disabled')
    expect(getCivicIdentityProofingIngressState()).toBe('disabled')
  })
})

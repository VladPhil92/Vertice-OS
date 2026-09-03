import { config } from '../../../config'
import {
  getActivatedCivicIdentityProviders,
  getCivicIdentityProviderActivationState,
  getCivicIdentityProofingIngressState,
  isActivatedCivicIdentityProvider,
} from '../identity-provider-registry'

const savedNodeEnv = config.NODE_ENV
const savedProviders = [...config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS]
const savedIngressSecret = config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET

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
  config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET = savedIngressSecret
})

describe('civic identity provider activation registry', () => {
  it('activates the synthetic adapter in test runtime only when configured', () => {
    config.NODE_ENV = 'test'
    replaceProviders('trusted_kyc')

    expect(getActivatedCivicIdentityProviders()).toEqual(['trusted_kyc'])
    expect(isActivatedCivicIdentityProvider(' Trusted_KYC ')).toBe(true)
    expect(getCivicIdentityProviderActivationState()).toBe('ready')
  })

  it('fails closed when configuration names a provider without a compiled adapter', () => {
    config.NODE_ENV = 'test'
    replaceProviders('unregistered_provider')

    expect(getActivatedCivicIdentityProviders()).toEqual([])
    expect(isActivatedCivicIdentityProvider('unregistered_provider')).toBe(false)
    expect(getCivicIdentityProviderActivationState()).toBe('misconfigured')
  })

  it('never permits the synthetic adapter in production', () => {
    config.NODE_ENV = 'production'
    replaceProviders('trusted_kyc')

    expect(getActivatedCivicIdentityProviders()).toEqual([])
    expect(isActivatedCivicIdentityProvider('trusted_kyc')).toBe(false)
    expect(getCivicIdentityProviderActivationState()).toBe('misconfigured')
  })

  it('marks ingress misconfigured when activation lacks its independent HMAC secret', () => {
    config.NODE_ENV = 'test'
    replaceProviders('trusted_kyc')
    config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET = undefined

    expect(getCivicIdentityProviderActivationState()).toBe('ready')
    expect(getCivicIdentityProofingIngressState()).toBe('misconfigured')
  })

  it('reports proofing disabled when neither provider nor ingress secret is configured', () => {
    replaceProviders()
    config.CIVIC_IDENTITY_PROOFING_EVENT_SECRET = undefined

    expect(getCivicIdentityProviderActivationState()).toBe('disabled')
    expect(getCivicIdentityProofingIngressState()).toBe('disabled')
  })
})

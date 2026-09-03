jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON: '',
  },
}))

import { config } from '../../../config'
import {
  getOperationalCivicIdentityProviders,
  getProofingProviderReadiness,
  resolveProofingAdapterSecret,
} from '../identity-proofing-provider-config'

const SECRET_A = 'provider-a-proofing-secret-32-chars!!'
const SECRET_B = 'provider-b-proofing-secret-32-chars!!'

beforeEach(() => {
  config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(
    0,
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length,
    'trusted_kyc',
  )
  config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = ''
})

describe('proofing provider configuration', () => {
  it('fails closed when a trusted provider has no ingress key', () => {
    expect(getOperationalCivicIdentityProviders()).toEqual([])
    expect(getProofingProviderReadiness()).toEqual({
      trusted_providers: 1,
      operational_providers: 0,
      fully_operational: false,
    })
  })

  it('fails closed on malformed feature-scoped JSON without crashing unrelated API config', () => {
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = '{broken'
    expect(getOperationalCivicIdentityProviders()).toEqual([])

    let error: unknown
    try {
      resolveProofingAdapterSecret('trusted_kyc', 'primary')
    } catch (caught) {
      error = caught
    }

    expect(error).toMatchObject({
      statusCode: 503,
      code: 'PROOFING_PROVIDER_CONFIG_INVALID',
    })
  })

  it('only activates providers present in both trust policy and key registry', () => {
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
      trusted_kyc: { primary: SECRET_A },
      untrusted_kyc: { primary: SECRET_B },
    })

    expect(getOperationalCivicIdentityProviders()).toEqual(['trusted_kyc'])
    expect(resolveProofingAdapterSecret('trusted_kyc', 'primary')).toEqual({
      provider: 'trusted_kyc',
      keyId: 'primary',
      secret: SECRET_A,
    })
    expect(() => resolveProofingAdapterSecret('untrusted_kyc', 'primary')).toThrow(
      'Proveedor de identity proofing no autorizado',
    )
  })

  it('supports overlapping key ids for zero-downtime rotation', () => {
    config.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
      trusted_kyc: { previous: SECRET_A, current: SECRET_B },
    })

    expect(resolveProofingAdapterSecret('trusted_kyc', 'previous').secret).toBe(SECRET_A)
    expect(resolveProofingAdapterSecret('trusted_kyc', 'current').secret).toBe(SECRET_B)
    expect(() => resolveProofingAdapterSecret('trusted_kyc', 'retired')).toThrow(
      'Identificador de llave de proofing inválido',
    )
  })
})
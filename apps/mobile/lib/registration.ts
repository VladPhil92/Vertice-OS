import { apiFetch, loginMobile } from './api'

export interface MobileRegistrationInput {
  email: string
  password: string
  cedula: string
}

export interface MobileRegistrationResult {
  citizen_id: string
  did: string
}

/**
 * Phase 7E keeps one identity source of truth.
 *
 * Account creation uses the canonical /auth/register endpoint. Native session
 * issuance immediately reuses /auth/mobile/token so refresh-token handling
 * remains identical to every other mobile sign-in.
 */
export async function registerAndLoginMobile(input: MobileRegistrationInput): Promise<MobileRegistrationResult> {
  const normalized = {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    cedula: input.cedula.replace(/\D/g, ''),
  }

  const registered = await apiFetch<MobileRegistrationResult>('/auth/register', {
    method: 'POST',
    public: true,
    body: JSON.stringify(normalized),
  })

  await loginMobile(normalized.email, normalized.password)
  return registered
}

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

export class PostRegistrationLoginRequiredError extends Error {
  readonly code = 'ACCOUNT_CREATED_LOGIN_REQUIRED'
  readonly accountCreated = true

  constructor(readonly email: string, cause?: unknown) {
    super('Tu cuenta fue creada, pero no pudimos iniciar la sesión. Ingresa con tu correo y contraseña para continuar al selector territorial.')
    this.name = 'PostRegistrationLoginRequiredError'
    if (cause !== undefined) this.cause = cause
  }
}

export function isPostRegistrationLoginRequiredError(error: unknown): error is PostRegistrationLoginRequiredError {
  return error instanceof PostRegistrationLoginRequiredError
    || (error instanceof Error && (error as Error & { code?: string }).code === 'ACCOUNT_CREATED_LOGIN_REQUIRED')
}

/**
 * Phase 7E keeps one identity source of truth.
 *
 * Account creation uses the canonical /auth/register endpoint. Native session
 * issuance immediately reuses /auth/mobile/token so refresh-token handling
 * remains identical to every other mobile sign-in.
 *
 * Registration and token issuance cannot be one database transaction because
 * they are separate HTTP contracts. If persistence succeeds but token issuance
 * fails, expose an explicit account-created state instead of retrying identity
 * creation and causing deterministic duplicate-account failures.
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

  try {
    await loginMobile(normalized.email, normalized.password)
  } catch (cause) {
    throw new PostRegistrationLoginRequiredError(normalized.email, cause)
  }

  return registered
}

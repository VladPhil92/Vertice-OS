import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { AuthProvider, useAuth } from './AuthProvider'
import type { CitizenProfile } from '../types/api'

jest.mock('../lib/api', () => ({
  apiFetch: jest.fn(),
  loginMobile: jest.fn(),
  logoutMobile: jest.fn(),
}))
jest.mock('../lib/ctgone', () => ({
  beginCtgOneMobileSignIn: jest.fn(),
  completeCtgOneMobileSignIn: jest.fn(),
}))
jest.mock('../lib/registration', () => ({
  registerAndLoginMobile: jest.fn(),
}))
jest.mock('../lib/session', () => ({
  clearSessionTokens: jest.fn(),
  getRefreshToken: jest.fn(),
}))
jest.mock('../lib/push-notifications', () => ({
  deactivatePushRegistration: jest.fn(),
}))

import { apiFetch, loginMobile, logoutMobile } from '../lib/api'
import { beginCtgOneMobileSignIn, completeCtgOneMobileSignIn } from '../lib/ctgone'
import { registerAndLoginMobile } from '../lib/registration'
import { clearSessionTokens, getRefreshToken } from '../lib/session'
import { deactivatePushRegistration } from '../lib/push-notifications'

const mockApiFetch = apiFetch as jest.Mock
const mockLoginMobile = loginMobile as jest.Mock
const mockLogoutMobile = logoutMobile as jest.Mock
const mockBeginCtgOne = beginCtgOneMobileSignIn as jest.Mock
const mockCompleteCtgOne = completeCtgOneMobileSignIn as jest.Mock
const mockRegisterAndLogin = registerAndLoginMobile as jest.Mock
const mockClearSessionTokens = clearSessionTokens as jest.Mock
const mockGetRefreshToken = getRefreshToken as jest.Mock
const mockDeactivatePush = deactivatePushRegistration as jest.Mock

const PROFILE: CitizenProfile = {
  id: 'citizen-1',
  did: 'did:vertice:citizen-1',
  email: 'ciudadano@example.com',
  neighborhood: 'Getsemaní',
  locality_id: 1,
  reputation_score: '12.5',
  verification_level: 2,
  created_at: '2026-01-01T00:00:00.000Z',
  last_active_at: '2026-09-14T00:00:00.000Z',
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

async function renderAuth() {
  const view = await renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  return view
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetRefreshToken.mockResolvedValue(null)
  mockDeactivatePush.mockResolvedValue(undefined)
})

describe('session bootstrap', () => {
  it('stays signed out and never calls /auth/me when there is no refresh token', async () => {
    const { result } = await renderAuth()

    expect(result.current.user).toBeNull()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('restores the profile when a refresh token is present', async () => {
    mockGetRefreshToken.mockResolvedValue('refresh-token')
    mockApiFetch.mockResolvedValue(PROFILE)

    const { result } = await renderAuth()

    expect(result.current.user).toEqual(PROFILE)
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/me')
  })

  it('clears the local session when the stored refresh token no longer resolves a profile', async () => {
    mockGetRefreshToken.mockResolvedValue('stale-refresh-token')
    mockApiFetch.mockRejectedValue(new Error('401'))

    const { result } = await renderAuth()

    expect(result.current.user).toBeNull()
    expect(mockClearSessionTokens).toHaveBeenCalledTimes(1)
  })
})

describe('signIn / signUp / CTG One', () => {
  it('signIn logs in and loads the profile', async () => {
    mockLoginMobile.mockResolvedValue(undefined)
    mockApiFetch.mockResolvedValue(PROFILE)
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.signIn('ciudadano@example.com', 'secret')
    })

    expect(mockLoginMobile).toHaveBeenCalledWith('ciudadano@example.com', 'secret')
    expect(result.current.user).toEqual(PROFILE)
  })

  it('signUp registers and loads the profile', async () => {
    mockRegisterAndLogin.mockResolvedValue(undefined)
    mockApiFetch.mockResolvedValue(PROFILE)
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.signUp('ciudadano@example.com', 'secret', '1234567890')
    })

    expect(mockRegisterAndLogin).toHaveBeenCalledWith({
      email: 'ciudadano@example.com',
      password: 'secret',
      cedula: '1234567890',
    })
    expect(result.current.user).toEqual(PROFILE)
  })

  it('completeCtgOneSignIn finishes the federation handoff and loads the profile', async () => {
    mockCompleteCtgOne.mockResolvedValue(undefined)
    mockApiFetch.mockResolvedValue(PROFILE)
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.completeCtgOneSignIn('auth-code', 'state-value')
    })

    expect(mockCompleteCtgOne).toHaveBeenCalledWith('auth-code', 'state-value')
    expect(result.current.user).toEqual(PROFILE)
  })

  it('signInWithCtgOne only starts the federation handoff, without touching the profile', async () => {
    mockBeginCtgOne.mockResolvedValue(undefined)
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.signInWithCtgOne()
    })

    expect(mockBeginCtgOne).toHaveBeenCalledTimes(1)
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  it('revokes the session and clears the user', async () => {
    mockGetRefreshToken.mockResolvedValue('refresh-token')
    mockApiFetch.mockResolvedValue(PROFILE)
    const { result } = await renderAuth()
    expect(result.current.user).toEqual(PROFILE)

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockLogoutMobile).toHaveBeenCalledTimes(1)
    expect(result.current.user).toBeNull()
  })

  it('still revokes the session and clears the user when push deactivation fails', async () => {
    mockGetRefreshToken.mockResolvedValue('refresh-token')
    mockApiFetch.mockResolvedValue(PROFILE)
    mockDeactivatePush.mockRejectedValue(new Error('expo unavailable'))
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockLogoutMobile).toHaveBeenCalledTimes(1)
    expect(result.current.user).toBeNull()
  })
})

describe('deleteAccount', () => {
  it('deactivates push, erases the account and clears the local session', async () => {
    const { result } = await renderAuth()
    const receipt = {
      request_id: 'req-1',
      status: 'completed' as const,
      completed_at: '2026-09-14T00:00:00.000Z',
      retention_policy_version: 'v1',
      retained_categories: [],
      auxiliary_cleanup_queued: false,
    }
    mockApiFetch.mockResolvedValue(receipt)

    let returned
    await act(async () => {
      returned = await result.current.deleteAccount()
    })

    expect(mockDeactivatePush).toHaveBeenCalledWith()
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: 'ELIMINAR', source: 'mobile' }),
    })
    expect(mockClearSessionTokens).toHaveBeenCalledTimes(1)
    expect(result.current.user).toBeNull()
    expect(returned).toEqual(receipt)
  })

  it('still erases the account when push deactivation fails, since erasure must not depend on Expo', async () => {
    mockDeactivatePush.mockRejectedValue(new Error('expo unavailable'))
    const { result } = await renderAuth()
    mockApiFetch.mockResolvedValue({ request_id: 'req-2', status: 'completed' })

    await act(async () => {
      await result.current.deleteAccount()
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/auth/account', expect.anything())
    expect(mockClearSessionTokens).toHaveBeenCalledTimes(1)
  })

  it('leaves the local session untouched when the server erasure call fails', async () => {
    mockGetRefreshToken.mockResolvedValue('refresh-token')
    mockApiFetch.mockResolvedValueOnce(PROFILE)
    const { result } = await renderAuth()
    expect(result.current.user).toEqual(PROFILE)

    mockApiFetch.mockRejectedValueOnce(new Error('server error'))

    await expect(
      act(async () => {
        await result.current.deleteAccount()
      }),
    ).rejects.toThrow('server error')

    expect(mockClearSessionTokens).not.toHaveBeenCalled()
    expect(result.current.user).toEqual(PROFILE)
  })
})

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', async () => {
    await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth must be used inside AuthProvider')
  })
})

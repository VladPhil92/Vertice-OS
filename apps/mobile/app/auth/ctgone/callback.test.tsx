import { render, screen, waitFor } from '@testing-library/react-native'

const mockReplace = jest.fn()
const mockUseLocalSearchParams = jest.fn()

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}))

const mockCompleteCtgOneSignIn = jest.fn()

jest.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({ completeCtgOneSignIn: mockCompleteCtgOneSignIn }),
}))

import CtgOneCallbackScreen from './callback'

describe('CtgOneCallbackScreen (vertice://auth/ctgone/callback)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fails closed and never attempts an exchange when CTG One omits code or state', async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: undefined, state: undefined })

    await render(<CtgOneCallbackScreen />)

    await waitFor(() => {
      expect(screen.getByText('CTG One no devolvió una autorización válida a VÉRTICE.')).toBeTruthy()
    })
    expect(mockCompleteCtgOneSignIn).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('exchanges the deep-link code/state and lands on the authenticated shell', async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: 'auth-code', state: 'mobile.abc' })
    mockCompleteCtgOneSignIn.mockResolvedValueOnce(undefined)

    await render(<CtgOneCallbackScreen />)

    await waitFor(() => {
      expect(mockCompleteCtgOneSignIn).toHaveBeenCalledWith('auth-code', 'mobile.abc')
    })
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
    })
  })

  it('surfaces the backend error message instead of silently retrying or navigating', async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: 'auth-code', state: 'mobile.abc' })
    mockCompleteCtgOneSignIn.mockRejectedValueOnce(new Error('El estado de autenticación móvil no coincide'))

    await render(<CtgOneCallbackScreen />)

    await waitFor(() => {
      expect(screen.getByText('El estado de autenticación móvil no coincide')).toBeTruthy()
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('falls back to a generic message for a non-Error rejection', async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: 'auth-code', state: 'mobile.abc' })
    mockCompleteCtgOneSignIn.mockRejectedValueOnce('network down')

    await render(<CtgOneCallbackScreen />)

    await waitFor(() => {
      expect(screen.getByText('No fue posible completar el acceso con CTG One.')).toBeTruthy()
    })
  })

  it('takes the first value when expo-router hands array-form query params', async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: ['auth-code', 'second'], state: ['mobile.abc', 'second'] })
    mockCompleteCtgOneSignIn.mockResolvedValueOnce(undefined)

    await render(<CtgOneCallbackScreen />)

    await waitFor(() => {
      expect(mockCompleteCtgOneSignIn).toHaveBeenCalledWith('auth-code', 'mobile.abc')
    })
  })
})

import { fireEvent, render, screen } from '@testing-library/react-native'

import { Alert, type AlertType } from './Alert'

describe('Alert', () => {
  it.each<AlertType>(['error', 'success', 'warning', 'info'])('renders the message for type=%s', async (type) => {
    await render(<Alert type={type} message={`Mensaje ${type}`} />)

    expect(screen.getByText(`Mensaje ${type}`)).toBeTruthy()
  })

  it('exposes an alert accessibility role for assistive technology', async () => {
    await render(<Alert type="error" message="Falló el envío" />)

    const container = screen.getByText('Falló el envío').parent?.parent
    expect(container?.props.accessibilityRole).toBe('alert')
  })

  it('renders an optional title above the message', async () => {
    await render(<Alert type="error" title="No pudimos completar la operación" message="Falló el envío" />)

    expect(screen.getByText('No pudimos completar la operación')).toBeTruthy()
    expect(screen.getByText('Falló el envío')).toBeTruthy()
  })

  it('omits the title when none is provided', async () => {
    await render(<Alert type="error" message="Falló el envío" />)

    expect(screen.queryByText('No pudimos completar la operación')).toBeNull()
  })

  it('fires the action callback when its button is pressed', async () => {
    const onPress = jest.fn()
    await render(
      <Alert type="error" message="No fue posible cargar" action={{ label: 'Reintentar', onPress }} />,
    )

    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('omits the action button when none is provided', async () => {
    await render(<Alert type="error" message="No fue posible cargar" />)

    expect(screen.queryByRole('button')).toBeNull()
  })
})

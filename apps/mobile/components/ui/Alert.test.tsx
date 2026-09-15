import { render, screen } from '@testing-library/react-native'

import { Alert, type AlertType } from './Alert'

describe('Alert', () => {
  it.each<AlertType>(['error', 'success', 'warning', 'info'])('renders the message for type=%s', async (type) => {
    await render(<Alert type={type} message={`Mensaje ${type}`} />)

    expect(screen.getByText(`Mensaje ${type}`)).toBeTruthy()
  })

  it('exposes an alert accessibility role for assistive technology', async () => {
    await render(<Alert type="error" message="Falló el envío" />)

    const container = screen.getByText('Falló el envío').parent
    expect(container?.props.accessibilityRole).toBe('alert')
  })
})

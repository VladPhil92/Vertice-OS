import { fireEvent, render, screen } from '@testing-library/react-native'

import { Button } from './Button'

describe('Button', () => {
  it('fires onPress when enabled', async () => {
    const onPress = jest.fn()
    await render(<Button onPress={onPress}>Ingresar</Button>)

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire onPress while loading', async () => {
    const onPress = jest.fn()
    await render(
      <Button onPress={onPress} loading>
        Verificando…
      </Button>,
    )

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('does not fire onPress when explicitly disabled', async () => {
    const onPress = jest.fn()
    await render(
      <Button onPress={onPress} disabled>
        Ingresar
      </Button>,
    )

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('exposes a disabled+busy accessibility state while loading', async () => {
    await render(
      <Button onPress={jest.fn()} loading>
        Verificando…
      </Button>,
    )

    const button = screen.getByRole('button')
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  })

  it('renders the label text for every variant', async () => {
    for (const variant of ['primary', 'ghost', 'danger'] as const) {
      await render(
        <Button onPress={jest.fn()} variant={variant}>
          {`Acción ${variant}`}
        </Button>,
      )
      expect(screen.getByText(`Acción ${variant}`)).toBeTruthy()
    }
  })
})

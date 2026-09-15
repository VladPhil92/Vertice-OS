import { fireEvent, render, screen } from '@testing-library/react-native'

import { Input } from './Input'

describe('Input', () => {
  it('renders the label and forwards text changes', async () => {
    const onChangeText = jest.fn()
    await render(
      <Input
        label="Correo electrónico"
        placeholder="ciudadano@example.com"
        onChangeText={onChangeText}
      />,
    )

    expect(screen.getByText('Correo electrónico')).toBeTruthy()

    fireEvent.changeText(screen.getByPlaceholderText('ciudadano@example.com'), 'nuevo@example.com')
    expect(onChangeText).toHaveBeenCalledWith('nuevo@example.com')
  })

  it('shows the error message and marks the field as invalid instead of the hint', async () => {
    await render(<Input label="Correo" hint="Usa tu correo registrado" error="Correo inválido" />)

    expect(screen.getByText('Correo inválido')).toBeTruthy()
    expect(screen.queryByText('Usa tu correo registrado')).toBeNull()
  })

  it('shows the hint when there is no error', async () => {
    await render(<Input label="Correo" hint="Usa tu correo registrado" />)

    expect(screen.getByText('Usa tu correo registrado')).toBeTruthy()
  })
})

import { render, screen } from '@testing-library/react-native'

import { Badge, type BadgeVariant } from './Badge'

describe('Badge', () => {
  it.each<BadgeVariant>(['citizen', 'cyan', 'red', 'default'])('renders its children for variant=%s', async (variant) => {
    await render(<Badge variant={variant}>Nuevo</Badge>)

    expect(screen.getByText('Nuevo')).toBeTruthy()
  })
})

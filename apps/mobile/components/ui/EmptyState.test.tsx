import { fireEvent, render, screen } from '@testing-library/react-native'

import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', async () => {
    await render(<EmptyState title="Sin reportes todavía" description="Crea tu primer reporte territorial." />)

    expect(screen.getByText('Sin reportes todavía')).toBeTruthy()
    expect(screen.getByText('Crea tu primer reporte territorial.')).toBeTruthy()
  })

  it('omits the action when none is provided', async () => {
    await render(<EmptyState title="Sin reportes todavía" />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fires the action callback when pressed', async () => {
    const onPress = jest.fn()
    await render(
      <EmptyState title="Sin reportes todavía" action={{ label: 'Crear reporte', onPress }} />,
    )

    fireEvent.press(screen.getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

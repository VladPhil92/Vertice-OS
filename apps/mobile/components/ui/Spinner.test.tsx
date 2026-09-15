import { render, screen } from '@testing-library/react-native'

import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('renders with an accessible loading label', async () => {
    await render(<Spinner />)

    expect(screen.getByLabelText('Cargando')).toBeTruthy()
  })
})

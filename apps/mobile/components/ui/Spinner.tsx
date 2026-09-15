import { ActivityIndicator } from 'react-native'

import { colors } from '../../theme/vertice'

export interface SpinnerProps {
  size?: 'small' | 'large'
  color?: string
}

/** Canonical native loading indicator. Mirrors packages/ui/src/Spinner.tsx. */
export function Spinner({ size = 'small', color = colors.navy }: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} accessibilityLabel="Cargando" />
}

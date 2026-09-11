import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { imagery } from '../theme/vertice'

type BrandVariant = 'wordmark' | 'symbol' | 'logo'

interface VerticeBrandProps {
  variant?: BrandVariant
  width?: number
  style?: StyleProp<ViewStyle>
}

const aspectRatio: Record<BrandVariant, number> = {
  wordmark: 4.2,
  symbol: 1,
  logo: 1,
}

export function VerticeBrand({ variant = 'wordmark', width = 176, style }: VerticeBrandProps) {
  const height = width / aspectRatio[variant]
  const source = variant === 'symbol'
    ? imagery.symbol
    : variant === 'logo'
      ? imagery.logo
      : imagery.wordmark

  return (
    <View accessibilityRole="image" accessibilityLabel="VÉRTICE" style={[styles.container, { width, height }, style]}>
      <Image source={source} resizeMode="contain" style={styles.image as StyleProp<ImageStyle>} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
})

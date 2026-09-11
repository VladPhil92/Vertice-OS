import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular'
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold'
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular'
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold'
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold'
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold'

/**
 * Native font binaries for the canonical VÉRTICE product language.
 *
 * These assets are bundled with the application through the Expo Google Fonts
 * packages. Web and native therefore use the same family contract while native
 * addresses each weight explicitly instead of depending on platform synthesis.
 */
export const verticeFontAssets = {
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  DMMono_400Regular,
  DMMono_500Medium,
} as const

export const nativeFontFamilies = {
  displayRegular: 'Montserrat_400Regular',
  displaySemibold: 'Montserrat_600SemiBold',
  displayBold: 'Montserrat_700Bold',
  displayExtraBold: 'Montserrat_800ExtraBold',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyExtraBold: 'Inter_800ExtraBold',
  monoRegular: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const

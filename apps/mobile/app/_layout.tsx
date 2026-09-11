import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'

import { NotificationBridge } from '../components/NotificationBridge'
import { AuthProvider } from '../providers/AuthProvider'
import { verticeFontAssets } from '../theme/fonts'
import { colors } from '../theme/vertice'

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(verticeFontAssets)

  useEffect(() => {
    if (fontError) {
      console.error('[brand-runtime] canonical VÉRTICE fonts failed to load', fontError)
    }
  }, [fontError])

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.brandRuntimeLoading} accessibilityLabel="Cargando identidad visual de VÉRTICE">
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    )
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <StatusBar style="dark" />
        <NotificationBridge />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="auth/ctgone/callback" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="community/[citizenId]" />
          <Stack.Screen name="community/leaderboard" />
          <Stack.Screen name="community/report" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="city/[code]" />
          <Stack.Screen name="territory/select" />
          <Stack.Screen name="territory/activate" />
          <Stack.Screen name="territory/assurance" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  brandRuntimeLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
})

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { AuthProvider } from '../providers/AuthProvider'
import { EngagementBridge } from '../providers/EngagementBridge'

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <StatusBar style="auto" />
        <EngagementBridge />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="notifications" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  )
}

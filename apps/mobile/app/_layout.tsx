import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { AuthProvider } from '../providers/AuthProvider'
import { NotificationBridge } from '../components/NotificationBridge'

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <StatusBar style="auto" />
        <NotificationBridge />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="community/[citizenId]" />
          <Stack.Screen name="community/leaderboard" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="city/[code]" />
          <Stack.Screen name="territory/select" />
          <Stack.Screen name="territory/activate" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  )
}

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { AuthProvider } from '../providers/AuthProvider'
import { NotificationBridge } from '../components/NotificationBridge'
import { colors } from '../theme/vertice'

export default function RootLayout() {
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

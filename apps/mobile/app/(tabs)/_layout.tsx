import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '../../providers/AuthProvider'
import { colors, typography } from '../../theme/vertice'

export default function TabsLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    )
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarActiveBackgroundColor: colors.surface,
        tabBarStyle: {
          minHeight: 68,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: typography.bodyFamily,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidad' }} />
      <Tabs.Screen name="actions" options={{ title: 'Acciones' }} />
      <Tabs.Screen name="reports" options={{ title: 'Territorio' }} />
      <Tabs.Screen name="governance" options={{ title: 'Gobernanza' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
})

import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '../../providers/AuthProvider'

export default function TabsLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1C3D2E',
        tabBarInactiveTintColor: '#6D7168',
        tabBarStyle: { minHeight: 68, paddingTop: 8, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})

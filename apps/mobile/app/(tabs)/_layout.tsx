import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'

import { VerticeIcon } from '../../components/VerticeIcon'
import { useAuth } from '../../providers/AuthProvider'
import { colors, iconography, interaction, radius, spacing, typography } from '../../theme/vertice'

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
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarActiveBackgroundColor: colors.infoBackground,
        tabBarInactiveBackgroundColor: colors.surface,
        tabBarStyle: {
          minHeight: 72,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          marginHorizontal: spacing.xxs,
          marginVertical: spacing.xxs,
          borderRadius: radius.sm,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 14,
          fontFamily: typography.bodyExtraBoldFamily,
          fontWeight: '800',
          letterSpacing: 0.15,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <VerticeIcon name="home" color={color} size={iconography.sizes.navigation} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color }) => <VerticeIcon name="community" color={color} size={iconography.sizes.navigation} />,
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Acciones',
          tabBarIcon: ({ color }) => <VerticeIcon name="actions" color={color} size={iconography.sizes.navigation} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Territorio',
          tabBarIcon: ({ color }) => <VerticeIcon name="territory" color={color} size={iconography.sizes.navigation} />,
        }}
      />
      <Tabs.Screen
        name="governance"
        options={{
          title: 'Gobernanza',
          tabBarIcon: ({ color }) => <VerticeIcon name="governance" color={color} size={iconography.sizes.navigation} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <VerticeIcon name="profile" color={color} size={iconography.sizes.navigation} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    opacity: interaction.disabledOpacity + 0.48,
  },
})

import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../../components/VerticeBrand'
import { colors, elevation, radius, spacing, typography } from '../../../theme/vertice'
import { useAuth } from '../../../providers/AuthProvider'

export default function CtgOneCallbackScreen() {
  const { completeCtgOneSignIn } = useAuth()
  const params = useLocalSearchParams<{ code?: string | string[]; state?: string | string[] }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      const code = Array.isArray(params.code) ? params.code[0] : params.code
      const state = Array.isArray(params.state) ? params.state[0] : params.state

      if (!code || !state) {
        if (active) setError('CTG One no devolvió una autorización válida a VÉRTICE.')
        return
      }

      try {
        await completeCtgOneSignIn(code, state)
        if (active) router.replace('/(tabs)')
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No fue posible completar el acceso con CTG One.')
        }
      }
    })()

    return () => { active = false }
  }, [completeCtgOneSignIn, params.code, params.state])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandShell}>
          <VerticeBrand variant="wordmark" width={166} />
        </View>

        <View style={styles.card}>
          <View style={styles.accentBar} />
          {error ? (
            <>
              <Text style={styles.eyebrow}>CTG ONE → VÉRTICE</Text>
              <Text style={styles.title}>No pudimos completar el acceso</Text>
              <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/(auth)/sign-in')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Volver a ingresar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.navy} />
              <Text style={styles.eyebrow}>CTG ONE → VÉRTICE</Text>
              <Text style={styles.title}>Conectando tu identidad</Text>
              <Text style={styles.body}>
                Estamos abriendo la misma cuenta ciudadana que utilizas en la web. No se está creando un perfil móvil independiente.
              </Text>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xl },
  brandShell: { alignSelf: 'center', borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  card: { overflow: 'hidden', borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.xl, gap: spacing.md, ...elevation.card },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: colors.citizen },
  eyebrow: { marginTop: spacing.sm, color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.title },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorText: { color: colors.red, fontFamily: typography.bodyFamily, ...typography.roles.body },
  primaryButton: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy, paddingHorizontal: spacing.lg },
  primaryButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  pressed: { opacity: 0.86 },
})

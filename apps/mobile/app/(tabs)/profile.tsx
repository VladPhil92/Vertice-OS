import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { useAuth } from '../../providers/AuthProvider'
import {
  deactivatePushRegistration,
  enablePushNotifications,
  getPushPreferenceState,
} from '../../lib/push-notifications'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'

export default function ProfileScreen() {
  const { user, signOut, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushRegistered, setPushRegistered] = useState(false)

  useEffect(() => {
    void getPushPreferenceState().then((state) => {
      setPushEnabled(state.enabled)
      setPushRegistered(state.registeredToken)
    })
  }, [])

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
      router.replace('/(auth)/sign-in')
    } finally {
      setBusy(false)
    }
  }

  async function togglePush() {
    setPushBusy(true)
    try {
      if (pushEnabled) {
        await deactivatePushRegistration()
        setPushEnabled(false)
        setPushRegistered(false)
        return
      }

      await enablePushNotifications()
      setPushEnabled(true)
      setPushRegistered(true)
    } catch (cause) {
      Alert.alert(
        'Notificaciones no disponibles',
        cause instanceof Error ? cause.message : 'No fue posible actualizar esta preferencia.',
      )
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <VerticeBrand variant="symbol" width={42} />
          </View>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>IDENTIDAD CIUDADANA</Text>
            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.subtitle}>Tu identidad, reputación y controles de cuenta en VÉRTICE.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.identityAccent} />
          <Text style={styles.email}>{user?.email ?? '—'}</Text>
          <Text style={styles.did}>{user?.did ?? 'Sin DID disponible'}</Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Barrio</Text>
            <Text style={styles.value}>{user?.neighborhood ?? 'No definido'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nivel de verificación</Text>
            <Text style={styles.value}>{user?.verification_level ?? 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reputación</Text>
            <Text style={styles.value}>{user?.reputation_score ?? '0'}</Text>
          </View>
        </View>

        <View style={styles.territoryCard}>
          <Text style={styles.cardKickerLight}>TERRITORIO</Text>
          <Text style={styles.territoryTitle}>Participación territorial</Text>
          <Text style={styles.territoryBody}>
            Consulta tu nodo territorial, apoya su activación comunitaria y revisa por separado si tu residencia está verificada para procesos de gobernanza. Ninguna de estas acciones modifica tu reputación ni concede autoridad por sí sola.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/territory/activate')}
            style={({ pressed }) => [styles.territoryButton, pressed && styles.pressed]}
          >
            <Text style={styles.territoryButtonText}>Mi ciudad y activación</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/territory/assurance')}
            style={({ pressed }) => [styles.assuranceButton, pressed && styles.pressed]}
          >
            <Text style={styles.assuranceButtonText}>Residencia y elegibilidad</Text>
          </Pressable>
        </View>

        <View style={styles.notificationCard}>
          <View style={styles.notificationCopy}>
            <Text style={styles.cardKicker}>PREFERENCIAS</Text>
            <Text style={styles.notificationTitle}>Actualizaciones cívicas</Text>
            <Text style={styles.notificationBody}>
              {pushEnabled
                ? pushRegistered
                  ? 'Este dispositivo está registrado para recibir alertas de reportes, propuestas y resultados.'
                  : 'La preferencia está activa y se reintentará el registro cuando el build tenga configuración EAS válida.'
                : 'Actívalas cuando quieras. VÉRTICE no solicita permisos de notificación automáticamente.'}
            </Text>
          </View>
          <Pressable
            disabled={pushBusy}
            onPress={() => void togglePush()}
            style={({ pressed }) => [
              styles.pushButton,
              pushEnabled && styles.pushButtonActive,
              pressed && styles.pressed,
              pushBusy && styles.disabled,
            ]}
          >
            <Text style={[styles.pushButtonText, pushEnabled && styles.pushButtonTextActive]}>
              {pushBusy ? 'Procesando…' : pushEnabled ? 'Desactivar' : 'Activar'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Ver notificaciones</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void refreshProfile()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>Actualizar perfil</Text>
          </Pressable>
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.notificationCopy}>
            <Text style={styles.cardKickerDanger}>PRIVACIDAD</Text>
            <Text style={styles.privacyTitle}>Privacidad y datos</Text>
            <Text style={styles.notificationBody}>
              Puedes eliminar tu cuenta directamente desde VÉRTICE. El proceso borra credenciales e identidad personal y explica qué registros deben conservarse de forma seudonimizada.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => router.push('/account-deletion')}
            style={({ pressed }) => [styles.deleteAccountButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.deleteAccountButtonText}>Eliminar mi cuenta</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text style={styles.dangerButtonText}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerBrand: { borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs },
  header: { flex: 1, gap: spacing.xxs },
  eyebrow: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.title },
  subtitle: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  card: { overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, ...elevation.card },
  identityAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.citizen },
  email: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 20, fontWeight: '800' },
  did: { color: colors.textTertiary, fontFamily: typography.monoFamily, fontSize: 11, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { flex: 1, color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  value: { flex: 1, textAlign: 'right', color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontWeight: '700' },
  territoryCard: { borderRadius: radius.xl, padding: spacing.md, backgroundColor: colors.navy, gap: spacing.xs, ...elevation.card },
  cardKickerLight: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  territoryTitle: { color: colors.white, fontFamily: typography.displayFamily, fontSize: 17, fontWeight: '800' },
  territoryBody: { color: colors.borderActive, fontFamily: typography.bodyFamily, lineHeight: 19 },
  territoryButton: { minHeight: interaction.buttonHeight, marginTop: spacing.xxs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface },
  territoryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  assuranceButton: { minHeight: interaction.buttonHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive },
  assuranceButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  notificationCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.infoBorder, padding: spacing.md, backgroundColor: colors.infoBackground, gap: spacing.sm },
  privacyCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.errorBorder, padding: spacing.md, backgroundColor: colors.errorBackground, gap: spacing.sm },
  notificationCopy: { gap: spacing.xxs },
  cardKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardKickerDanger: { color: colors.errorText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  notificationTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 17, fontWeight: '800' },
  privacyTitle: { color: colors.errorText, fontFamily: typography.displayFamily, fontSize: 17, fontWeight: '800' },
  notificationBody: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 19 },
  pushButton: { minHeight: interaction.buttonHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface },
  pushButtonActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  pushButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  pushButtonTextActive: { color: colors.white },
  actionGrid: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, minHeight: interaction.buttonHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption, textAlign: 'center' },
  deleteAccountButton: { minHeight: interaction.buttonHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.errorText, backgroundColor: colors.surface },
  deleteAccountButtonText: { color: colors.errorText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  dangerButton: { minHeight: interaction.buttonHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.errorText },
  dangerButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

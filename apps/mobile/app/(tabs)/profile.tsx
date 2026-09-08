import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../providers/AuthProvider'
import {
  deactivatePushRegistration,
  enablePushNotifications,
  getPushPreferenceState,
} from '../../lib/push-notifications'

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>IDENTIDAD CIUDADANA</Text>
          <Text style={styles.title}>Perfil</Text>
        </View>

        <View style={styles.card}>
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

        <View style={styles.notificationCard}>
          <View style={styles.notificationCopy}>
            <Text style={styles.notificationTitle}>Actualizaciones cívicas</Text>
            <Text style={styles.notificationBody}>
              {pushEnabled
                ? pushRegistered
                  ? 'Este dispositivo está registrado para recibir alertas de reportes, propuestas y resultados.'
                  : 'La preferencia está activa y se reintentará el registro cuando el build tenga configuración EAS válida.'
                : 'Actívalas cuando quieras. Vértice no solicita permisos de notificación automáticamente.'}
            </Text>
          </View>
          <Pressable
            disabled={pushBusy}
            onPress={() => void togglePush()}
            style={[styles.pushButton, pushEnabled && styles.pushButtonActive, pushBusy && styles.disabled]}
          >
            <Text style={[styles.pushButtonText, pushEnabled && styles.pushButtonTextActive]}>
              {pushBusy ? 'Procesando…' : pushEnabled ? 'Desactivar' : 'Activar'}
            </Text>
          </Pressable>
        </View>

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
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>Actualizar perfil</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text style={styles.dangerButtonText}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  container: { flex: 1, padding: 20, gap: 16 },
  header: { paddingTop: 8, marginBottom: 8, gap: 6 },
  eyebrow: { fontSize: 12, letterSpacing: 1.8, fontWeight: '700', color: '#697068' },
  title: { fontSize: 32, fontWeight: '700', color: '#11130F' },
  card: { borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF', gap: 10 },
  email: { fontSize: 20, fontWeight: '700', color: '#171A15' },
  did: { fontSize: 12, lineHeight: 18, color: '#74786F' },
  divider: { height: 1, backgroundColor: '#ECE9E1', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { flex: 1, color: '#6C7068' },
  value: { flex: 1, textAlign: 'right', fontWeight: '600', color: '#24271F' },
  notificationCard: { borderRadius: 20, padding: 16, backgroundColor: '#E7E4D8', gap: 12 },
  notificationCopy: { gap: 5 },
  notificationTitle: { fontSize: 17, fontWeight: '700', color: '#171A15' },
  notificationBody: { color: '#565D54', lineHeight: 19 },
  pushButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#AEB7AF', backgroundColor: '#FFFFFF' },
  pushButtonActive: { backgroundColor: '#17382A', borderColor: '#17382A' },
  pushButtonText: { color: '#17382A', fontWeight: '700' },
  pushButtonTextActive: { color: '#FFFFFF' },
  secondaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#B9BDB5' },
  secondaryButtonText: { fontWeight: '700', color: '#263228' },
  dangerButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F4DFDC' },
  dangerButtonText: { fontWeight: '700', color: '#812F2F' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
})

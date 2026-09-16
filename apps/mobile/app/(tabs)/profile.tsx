import { useEffect, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { Alert as UiAlert } from '../../components/ui'
import { useAuth } from '../../providers/AuthProvider'
import {
  getCivicAvatarState,
  removeCivicAvatar,
  selectCivicAvatarPhoto,
  uploadAndConfirmCivicAvatar,
  type SelectedAvatarPhoto,
} from '../../lib/civic-avatar'
import {
  deactivatePushRegistration,
  enablePushNotifications,
  getPushPreferenceState,
} from '../../lib/push-notifications'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { CivicAvatarState } from '../../types/api'

const AVATAR_POLICY_TEXT = 'Confirmo que esta fotografía me representa, muestra un solo rostro claramente visible y no utiliza suplantación, logo, ilustración ni alteraciones que impidan reconocerme.'

export default function ProfileScreen() {
  const { user, signOut, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushRegistered, setPushRegistered] = useState(false)
  const [avatar, setAvatar] = useState<CivicAvatarState | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [pendingAvatarPhoto, setPendingAvatarPhoto] = useState<SelectedAvatarPhoto | null>(null)
  const [avatarPolicyAttested, setAvatarPolicyAttested] = useState(false)

  useEffect(() => {
    void getPushPreferenceState().then((state) => {
      setPushEnabled(state.enabled)
      setPushRegistered(state.registeredToken)
    })
  }, [])

  useEffect(() => {
    void getCivicAvatarState()
      .then(setAvatar)
      .catch(() => setAvatar(null))
  }, [])

  async function chooseAvatarPhoto(source: 'camera' | 'library') {
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const photo = await selectCivicAvatarPhoto(source)
      if (!photo) return
      setAvatarPolicyAttested(false)
      setPendingAvatarPhoto(photo)
    } catch (cause) {
      setAvatarError(cause instanceof Error ? cause.message : 'No fue posible actualizar tu foto de perfil.')
    } finally {
      setAvatarBusy(false)
    }
  }

  function cancelAvatarPreview() {
    setPendingAvatarPhoto(null)
    setAvatarPolicyAttested(false)
  }

  async function confirmAvatarUpload() {
    if (!pendingAvatarPhoto) return
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      setAvatar(await uploadAndConfirmCivicAvatar(pendingAvatarPhoto, avatarPolicyAttested))
      setPendingAvatarPhoto(null)
      setAvatarPolicyAttested(false)
    } catch (cause) {
      setAvatarError(cause instanceof Error ? cause.message : 'No fue posible actualizar tu foto de perfil.')
    } finally {
      setAvatarBusy(false)
    }
  }

  function confirmRemoveAvatar() {
    Alert.alert(
      'Eliminar foto de perfil',
      'Tu foto de perfil dejará de mostrarse en VÉRTICE.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setAvatarBusy(true)
              setAvatarError(null)
              try {
                setAvatar(await removeCivicAvatar())
              } catch (cause) {
                setAvatarError(cause instanceof Error ? cause.message : 'No fue posible eliminar tu foto de perfil.')
              } finally {
                setAvatarBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

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

          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              {avatar?.avatar_url ? (
                <Image source={{ uri: avatar.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{(user?.email ?? '?').charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.avatarActions}>
              <Pressable
                disabled={avatarBusy || avatar?.upload_enabled === false}
                accessibilityRole="button"
                onPress={() => void chooseAvatarPhoto('camera')}
                style={({ pressed }) => [styles.avatarAction, pressed && styles.pressed, (avatarBusy || avatar?.upload_enabled === false) && styles.disabled]}
              >
                <Text style={styles.avatarActionText}>Tomar foto</Text>
              </Pressable>
              <Pressable
                disabled={avatarBusy || avatar?.upload_enabled === false}
                accessibilityRole="button"
                onPress={() => void chooseAvatarPhoto('library')}
                style={({ pressed }) => [styles.avatarAction, pressed && styles.pressed, (avatarBusy || avatar?.upload_enabled === false) && styles.disabled]}
              >
                <Text style={styles.avatarActionText}>Elegir foto</Text>
              </Pressable>
              {avatar?.avatar_url ? (
                <Pressable
                  disabled={avatarBusy}
                  accessibilityRole="button"
                  onPress={confirmRemoveAvatar}
                  style={({ pressed }) => [styles.avatarRemove, pressed && styles.pressed, avatarBusy && styles.disabled]}
                >
                  <Text style={styles.avatarRemoveText}>Eliminar</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {avatar?.upload_enabled === false ? (
            <UiAlert type="warning" message="La carga de imágenes está temporalmente deshabilitada. El resto del perfil puede editarse normalmente." />
          ) : null}
          {avatarError ? <UiAlert type="error" message={avatarError} /> : null}

          {pendingAvatarPhoto ? (
            <View style={styles.avatarPreviewCard}>
              <View style={styles.avatarPreviewRow}>
                <Image source={{ uri: pendingAvatarPhoto.uri }} style={styles.avatarPreviewImage} />
                <View style={styles.avatarPreviewCopy}>
                  <Text style={styles.avatarPreviewTitle}>Confirmar retrato</Text>
                  <Text style={styles.avatarPreviewMeta}>{pendingAvatarPhoto.width} × {pendingAvatarPhoto.height} px</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: avatarPolicyAttested }}
                onPress={() => setAvatarPolicyAttested((prev) => !prev)}
                style={styles.avatarPolicyRow}
              >
                <View style={[styles.avatarPolicyBox, avatarPolicyAttested && styles.avatarPolicyBoxChecked]}>
                  {avatarPolicyAttested ? <VerticeIcon name="checkCircle" color={colors.white} size={14} /> : null}
                </View>
                <Text style={styles.avatarPolicyText}>{AVATAR_POLICY_TEXT}</Text>
              </Pressable>
              <View style={styles.avatarPreviewActions}>
                <Pressable
                  disabled={avatarBusy}
                  accessibilityRole="button"
                  onPress={cancelAvatarPreview}
                  style={({ pressed }) => [styles.avatarPreviewCancel, pressed && styles.pressed, avatarBusy && styles.disabled]}
                >
                  <Text style={styles.avatarPreviewCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  disabled={avatarBusy || !avatarPolicyAttested}
                  accessibilityRole="button"
                  onPress={() => void confirmAvatarUpload()}
                  style={({ pressed }) => [styles.avatarPreviewConfirm, pressed && styles.pressed, (avatarBusy || !avatarPolicyAttested) && styles.disabled]}
                >
                  <Text style={styles.avatarPreviewConfirmText}>{avatarBusy ? 'Subiendo…' : 'Usar esta foto'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarCircle: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 64, height: 64, borderRadius: radius.pill },
  avatarInitial: { color: colors.navy, fontFamily: typography.displayFamily, fontSize: 24, fontWeight: '800' },
  avatarActions: { flex: 1, flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  avatarAction: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  avatarActionText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  avatarRemove: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.errorText, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  avatarRemoveText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  avatarPreviewCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, padding: spacing.sm, gap: spacing.sm },
  avatarPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarPreviewImage: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface },
  avatarPreviewCopy: { flex: 1, gap: spacing.xxs },
  avatarPreviewTitle: { color: colors.textPrimary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  avatarPreviewMeta: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 11 },
  avatarPolicyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  avatarPolicyBox: { width: 20, height: 20, marginTop: 1, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.borderActive, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarPolicyBoxChecked: { backgroundColor: colors.navy, borderColor: colors.navy },
  avatarPolicyText: { flex: 1, color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 11, lineHeight: 16 },
  avatarPreviewActions: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-end' },
  avatarPreviewCancel: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  avatarPreviewCancelText: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  avatarPreviewConfirm: { minHeight: interaction.minimumTouchTarget, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  avatarPreviewConfirmText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
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

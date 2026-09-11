import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../components/VerticeBrand'
import { VerticeIcon } from '../components/VerticeIcon'
import { useAuth } from '../providers/AuthProvider'
import { colors, elevation, interaction, radius, spacing, typography } from '../theme/vertice'

const REQUIRED_CONFIRMATION = 'ELIMINAR'

export default function AccountDeletionScreen() {
  const { deleteAccount } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const canDelete = confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION && !busy

  async function executeDeletion() {
    if (!canDelete) return

    Alert.alert(
      'Eliminar cuenta de forma permanente',
      'Esta acción elimina tus credenciales e identidad personal de VÉRTICE y no puede deshacerse.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar definitivamente',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true)
              try {
                await deleteAccount()
                router.replace('/(auth)/sign-in')
                Alert.alert(
                  'Cuenta eliminada',
                  'Tus credenciales e identidad personal fueron eliminadas. Algunos registros cívicos, financieros o de auditoría pueden conservarse únicamente de forma seudonimizada cuando exista una obligación de integridad o retención.',
                )
              } catch (cause) {
                Alert.alert(
                  'No fue posible eliminar la cuenta',
                  cause instanceof Error ? cause.message : 'Vuelve a iniciar sesión e intenta nuevamente.',
                )
              } finally {
                setBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <Text style={styles.brandContext}>PRIVACIDAD</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <VerticeIcon name="back" color={colors.navy} size={18} />
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>PRIVACIDAD Y DATOS</Text>
          <Text style={styles.title}>Eliminar mi cuenta</Text>
          <Text style={styles.lead}>
            VÉRTICE ofrece eliminación de cuenta dentro de la aplicación. No necesitas contactar soporte para iniciar el proceso.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Se elimina de forma irreversible</Text>
          <Text style={styles.item}>• correo, hash de documento y contraseña</Text>
          <Text style={styles.item}>• sesiones, roles activos e identidades federadas</Text>
          <Text style={styles.item}>• proofing/KYC cívico y referencias del proveedor</Text>
          <Text style={styles.item}>• dispositivos push, perfil público, avatar y red de seguidores</Text>
          <Text style={styles.item}>• publicaciones sociales programadas o publicadas</Text>
        </View>

        <View style={styles.retentionCard}>
          <Text style={styles.retentionKicker}>RETENCIÓN LIMITADA</Text>
          <Text style={styles.cardTitle}>Qué puede conservarse</Text>
          <Text style={styles.body}>
            Registros cívicos, financieros y de auditoría pueden conservarse cuando sean necesarios para integridad histórica, contabilidad, prevención de fraude o resolución de disputas. La relación personal directa se elimina o se seudonimiza y tu perfil deja de ser público.
          </Text>
        </View>

        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <View style={styles.dangerIcon}>
              <VerticeIcon name="delete" color={colors.white} size={20} />
            </View>
            <View style={styles.warningCopy}>
              <Text style={styles.warningKicker}>ACCIÓN IRREVERSIBLE</Text>
              <Text style={styles.warningTitle}>Esta acción no se puede deshacer</Text>
            </View>
          </View>
          <Text style={styles.warningBody}>
            Para evitar eliminaciones accidentales, escribe {REQUIRED_CONFIRMATION} y confirma nuevamente en el diálogo del sistema.
          </Text>
          <Text style={styles.label}>CONFIRMACIÓN</Text>
          <TextInput
            accessibilityLabel="Confirmación para eliminar la cuenta"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setConfirmation}
            placeholder={REQUIRED_CONFIRMATION}
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            value={confirmation}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDelete }}
            disabled={!canDelete}
            onPress={() => void executeDeletion()}
            style={({ pressed }) => [
              styles.deleteButton,
              !canDelete && styles.disabled,
              pressed && canDelete && styles.pressed,
            ]}
          >
            <VerticeIcon name="delete" color={colors.white} size={18} />
            <Text style={styles.deleteButtonText}>{busy ? 'Eliminando…' : 'Eliminar mi cuenta'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandContext: { color: colors.textTertiary, ...typography.roles.label },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backButtonText: { color: colors.navy, ...typography.roles.caption },
  header: { gap: spacing.sm, marginBottom: spacing.xxs },
  eyebrow: { color: colors.textTertiary, ...typography.roles.label },
  title: { color: colors.textPrimary, ...typography.roles.hero },
  lead: { color: colors.textSecondary, ...typography.roles.subtitle },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  retentionCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.infoBackground, gap: spacing.xs, borderWidth: 1, borderColor: colors.infoBorder },
  retentionKicker: { color: colors.infoText, ...typography.roles.label },
  warningCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.errorBackground, gap: spacing.sm, borderWidth: 1, borderColor: colors.errorBorder },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dangerIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red },
  warningCopy: { flex: 1, gap: spacing.xxs },
  warningKicker: { color: colors.errorText, ...typography.roles.label },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  warningTitle: { color: colors.errorText, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  item: { color: colors.textSecondary, ...typography.roles.body },
  body: { color: colors.textSecondary, ...typography.roles.body },
  warningBody: { color: colors.errorText, ...typography.roles.body },
  label: { color: colors.errorText, ...typography.roles.label },
  input: {
    minHeight: interaction.inputHeight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: typography.bodyBoldFamily,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: interaction.buttonHeight,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.red,
  },
  deleteButtonText: { color: colors.white, ...typography.roles.button },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

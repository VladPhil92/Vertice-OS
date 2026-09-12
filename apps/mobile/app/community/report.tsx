import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiMutation } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type {
  CommunitySafetyReason,
  CommunitySafetyReportReceipt,
  CommunitySafetyTargetType,
} from '../../types/community-safety'

const REASONS: Array<{ id: CommunitySafetyReason; label: string; help: string }> = [
  { id: 'harassment', label: 'Acoso o intimidación', help: 'Ataques personales, amenazas o hostigamiento.' },
  { id: 'hate', label: 'Odio o discriminación', help: 'Ataques contra personas o grupos protegidos.' },
  { id: 'sexual_content', label: 'Contenido sexual', help: 'Contenido sexual explícito o explotación.' },
  { id: 'violence', label: 'Violencia o amenaza', help: 'Amenazas, incitación o violencia gráfica indebida.' },
  { id: 'spam', label: 'Spam o fraude', help: 'Promoción engañosa, contenido repetitivo o manipulación.' },
  { id: 'impersonation', label: 'Suplantación', help: 'Un perfil o publicación intenta hacerse pasar por otra persona.' },
  { id: 'privacy', label: 'Privacidad', help: 'Publicación indebida de datos personales o sensibles.' },
  { id: 'other', label: 'Otro incumplimiento', help: 'Otro posible incumplimiento de las Normas de Comunidad.' },
]

const TARGET_TYPES = new Set<CommunitySafetyTargetType>(['profile', 'report', 'proposal', 'publication'])

function normalizedParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export default function CommunityReportScreen() {
  const params = useLocalSearchParams<{ targetType?: string | string[]; targetId?: string | string[]; label?: string | string[] }>()
  const rawTargetType = normalizedParam(params.targetType)
  const targetType = TARGET_TYPES.has(rawTargetType as CommunitySafetyTargetType)
    ? rawTargetType as CommunitySafetyTargetType
    : null
  const targetId = normalizedParam(params.targetId) ?? null
  const targetLabel = normalizedParam(params.label)
  const [reason, setReason] = useState<CommunitySafetyReason>('harassment')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = useMemo(() => Boolean(targetType && targetId), [targetId, targetType])

  async function submit() {
    if (!targetType || !targetId || busy) return
    setBusy(true)
    setError(null)
    try {
      await apiMutation<CommunitySafetyReportReceipt>(
        '/community/safety/reports',
        `mobile-community-report-${targetType}-${targetId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            reason,
            details: details.trim().length >= 5 ? details.trim() : null,
          }),
        },
      )
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible enviar la denuncia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="moderation" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>MODERACIÓN</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <VerticeIcon name="back" color={colors.navy} size={18} />
          <Text style={styles.backText}>Volver</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <VerticeIcon name="moderation" color={colors.white} size={26} />
          </View>
          <Text style={styles.eyebrow}>SEGURIDAD DE LA COMUNIDAD</Text>
          <Text style={styles.title}>Reportar contenido o perfil</Text>
          <Text style={styles.heroBody}>
            La denuncia abre un caso de moderación. No sanciona automáticamente, no modifica reputación y no determina identidad ni autoridad cívica.
          </Text>
          {targetLabel ? (
            <View style={styles.targetPill}>
              <VerticeIcon name="flag" color={colors.warningText} size={15} />
              <Text style={styles.targetText} numberOfLines={2}>{targetLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.boundaryCard}>
          <VerticeIcon name="shield" color={colors.infoText} size={22} />
          <View style={styles.boundaryCopy}>
            <Text style={styles.boundaryKicker}>DEBIDO PROCESO DE MODERACIÓN</Text>
            <Text style={styles.boundaryText}>
              Reportar es una señal para revisión, no una sentencia. El resultado del caso lo determina el flujo de moderación del backend y puede ser descartado si no corresponde a una infracción.
            </Text>
          </View>
        </View>

        {!valid ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>El objetivo de esta denuncia no es válido.</Text>
          </View>
        ) : sent ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <VerticeIcon name="checkCircle" color={colors.successText} size={26} />
            </View>
            <Text style={styles.successTitle}>Denuncia recibida</Text>
            <Text style={styles.successText}>El caso quedó registrado para revisión de moderación. El envío no implica sanción automática.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Continuar</Text>
              <VerticeIcon name="chevronRight" color={colors.navy} size={18} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}>
                <VerticeIcon name="flag" color={colors.navy} size={20} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionKicker}>MOTIVO</Text>
                <Text style={styles.sectionTitle}>¿Qué debería revisar moderación?</Text>
              </View>
            </View>

            <View style={styles.reasonList}>
              {REASONS.map((item) => {
                const selected = reason === item.id
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setReason(item.id)}
                    style={({ pressed }) => [styles.reasonCard, selected && styles.reasonCardActive, pressed && styles.pressed]}
                  >
                    <VerticeIcon name={selected ? 'checkCircle' : 'circle'} color={selected ? colors.navy : colors.textTertiary} size={20} />
                    <View style={styles.reasonCopy}>
                      <Text style={styles.reasonTitle}>{item.label}</Text>
                      <Text style={styles.reasonHelp}>{item.help}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}>
                <VerticeIcon name="evidence" color={colors.navy} size={20} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionKicker}>CONTEXTO ADICIONAL</Text>
                <Text style={styles.sectionTitle}>Ayuda a revisar el caso</Text>
              </View>
            </View>

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Describe brevemente qué debería revisar moderación."
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.textArea}
            />
            <Text style={styles.counter}>{details.length}/1000</Text>

            {error ? (
              <View style={styles.errorCard}>
                <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !valid }}
              disabled={busy || !valid}
              onPress={() => void submit()}
              style={({ pressed }) => [styles.primaryButton, (busy || !valid) && styles.disabled, pressed && !busy && valid && styles.pressed]}
            >
              <VerticeIcon name="flag" color={colors.navy} size={18} />
              <Text style={styles.primaryButtonText}>{busy ? 'Enviando…' : 'Enviar a moderación'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.warningBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  targetPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.warningBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  targetText: { maxWidth: '90%', color: colors.warningText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  boundaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  boundaryCopy: { flex: 1, gap: spacing.xxs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBackground, padding: spacing.md },
  errorText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  successCard: { alignItems: 'center', borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.successBackground, borderWidth: 1, borderColor: colors.successBorder, ...elevation.card },
  successIcon: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  successTitle: { color: colors.successText, fontFamily: typography.displayBoldFamily, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  successText: { color: colors.successText, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sectionCopy: { flex: 1, gap: spacing.xxs },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  reasonList: { gap: spacing.sm },
  reasonCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md },
  reasonCardActive: { borderColor: colors.navy, backgroundColor: colors.infoBackground },
  reasonCopy: { flex: 1, gap: spacing.xxs },
  reasonTitle: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  reasonHelp: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 18 },
  textArea: { minHeight: 132, borderRadius: radius.lg, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder, fontFamily: typography.bodyFamily, ...typography.roles.body },
  counter: { color: colors.textTertiary, textAlign: 'right', fontFamily: typography.bodySemiboldFamily, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.citizen, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

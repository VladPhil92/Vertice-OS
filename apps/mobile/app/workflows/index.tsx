import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { CivicCase, CivicCaseListResponse } from '../../types/domain-parity'

const STAGE_LABELS: Record<string, string> = {
  reported: 'Reporte abierto',
  analysis: 'Análisis territorial',
  proposal_drafting: 'Preparando propuesta',
  proposal: 'Propuesta creada',
  deliberation: 'Deliberación',
  voting: 'En votación',
  decision: 'Decisión',
  control_drafting: 'Preparando control',
  control: 'Control ciudadano',
}

function CaseCard({ item }: { item: CivicCase }) {
  const progress = [
    { label: 'Análisis', complete: Boolean(item.analysis) },
    { label: 'Propuesta', complete: Boolean(item.proposal) },
    { label: 'Control', complete: Boolean(item.control) },
  ]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.report.title}. Etapa: ${STAGE_LABELS[item.stage] ?? item.stage}. Estado del reporte: ${item.report.status}. Abrir expediente.`}
      onPress={() => router.push(`/workflows/${item.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.stagePill}>
          <VerticeIcon name="workflow" color={colors.infoText} size={15} />
          <Text style={styles.stage}>{STAGE_LABELS[item.stage] ?? item.stage}</Text>
        </View>
        <Text style={styles.status}>{item.report.status}</Text>
      </View>

      <Text style={styles.cardTitle}>{item.report.title}</Text>
      <Text style={styles.meta}>
        {item.report.category}{item.report.neighborhood ? ` · ${item.report.neighborhood}` : ''}
      </Text>

      <View style={styles.progressRow}>
        {progress.map((entry) => (
          <View key={entry.label} style={[styles.progressPill, entry.complete && styles.progressPillComplete]}>
            <VerticeIcon
              name={entry.complete ? 'checkCircle' : 'circle'}
              color={entry.complete ? colors.successText : colors.textTertiary}
              size={14}
            />
            <Text style={[styles.progressText, entry.complete && styles.progressTextComplete]}>{entry.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.openRow}>
        <Text style={styles.openText}>Ver trazabilidad</Text>
        <VerticeIcon name="chevronRight" color={colors.navy} size={18} />
      </View>
    </Pressable>
  )
}

export default function WorkflowsScreen() {
  const [items, setItems] = useState<CivicCase[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<CivicCaseListResponse>('/workflows/cases?limit=50')
      setItems(response.data)
    } catch (cause) {
      setItems([])
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tus expedientes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}
      >
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="case" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>EXPEDIENTES</Text>
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
            <VerticeIcon name="workflow" color={colors.white} size={27} />
          </View>
          <Text style={styles.eyebrow}>CONTINUIDAD CÍVICA</Text>
          <Text style={styles.title}>Tus expedientes</Text>
          <Text style={styles.heroBody}>
            Sigue la evidencia territorial y los artefactos persistidos de cada caso sin confundir visualización con una decisión administrativa.
          </Text>
        </View>

        <View style={styles.authorityCard}>
          <VerticeIcon name="shield" color={colors.infoText} size={22} />
          <View style={styles.authorityCopy}>
            <Text style={styles.authorityKicker}>AUTORIDAD DEL ESTADO</Text>
            <Text style={styles.authorityText}>
              El backend conserva la autoridad sobre el estado administrativo. Esta app refleja el expediente persistido y no crea, adelanta ni resuelve etapas por sí sola.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="case" color={colors.azure} size={24} />
            <Text style={styles.stateText}>Cargando expedientes…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No disponible</Text>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Los expedientes requieren una cuenta verificada.</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <VerticeIcon name="refresh" color={colors.navy} size={18} />
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => <CaseCard key={item.id} item={item} />)}
          {!loading && !error && items.length === 0 ? (
            <View style={styles.emptyCard}>
              <VerticeIcon name="case" color={colors.textTertiary} size={26} />
              <Text style={styles.empty}>Aún no tienes expedientes cívicos.</Text>
              <Text style={styles.emptyHint}>Cuando un reporte origine un caso persistido, aparecerá aquí con su trazabilidad.</Text>
            </View>
          ) : null}
        </View>
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
  heroIcon: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  authorityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  authorityCopy: { flex: 1, gap: spacing.xxs },
  authorityKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  authorityText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  stateCard: { minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateText: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  list: { gap: spacing.sm },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...elevation.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stagePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, alignSelf: 'flex-start', borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  stage: { flexShrink: 1, color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  status: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  progressPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  progressPillComplete: { backgroundColor: colors.successBackground },
  progressText: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  progressTextComplete: { color: colors.successText },
  openRow: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xxs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
  openText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  errorCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, gap: spacing.xs },
  errorTitle: { color: colors.errorText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  errorText: { color: colors.errorText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorHint: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  retryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.errorBorder },
  retryText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  emptyCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  empty: { color: colors.textPrimary, textAlign: 'center', fontFamily: typography.bodyBoldFamily, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  emptyHint: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  pressed: { opacity: interaction.pressedOpacity },
})

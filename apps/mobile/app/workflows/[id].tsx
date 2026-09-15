import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon, type VerticeIconName } from '../../components/VerticeIcon'
import { Alert } from '../../components/ui'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { CivicCase } from '../../types/domain-parity'

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

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha registrada'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function ArtifactStep({
  title,
  complete,
  detail,
  icon,
}: {
  title: string
  complete: boolean
  detail: string
  icon: VerticeIconName
}) {
  return (
    <View style={[styles.artifactCard, complete && styles.artifactCardComplete]}>
      <View style={[styles.artifactIcon, complete && styles.artifactIconComplete]}>
        <VerticeIcon name={complete ? 'checkCircle' : icon} color={complete ? colors.successText : colors.textTertiary} size={20} />
      </View>
      <View style={styles.artifactCopy}>
        <Text style={[styles.artifactTitle, complete && styles.artifactTitleComplete]}>{title}</Text>
        <Text style={styles.artifactDetail}>{detail}</Text>
      </View>
    </View>
  )
}

function artifactVisibilityMessage(item: CivicCase) {
  const missing: string[] = []
  if (!item.analysis) missing.push('análisis territorial')
  if (!item.proposal) missing.push('propuesta')
  if (!item.control) missing.push('actuación de control')

  if (missing.length === 0) {
    return 'El expediente expone reporte, análisis, propuesta y control persistidos. La etapa actual del servidor sigue siendo la referencia administrativa vigente.'
  }

  return `El servidor no expone actualmente ${missing.join(', ')} en este expediente. Su ausencia no significa que sean requisitos previos ni pasos pendientes en una secuencia obligatoria.`
}

export default function WorkflowDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = useMemo(() => Array.isArray(params.id) ? params.id[0] : params.id, [params.id])
  const [item, setItem] = useState<CivicCase | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setError('Expediente inválido.')
      setLoading(false)
      return
    }
    setError(null)
    try {
      setItem(await apiFetch<CivicCase>(`/workflows/cases/${encodeURIComponent(id)}`))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el expediente.')
    } finally {
      setLoading(false)
    }
  }, [id])

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
            <Text style={styles.sectionBadgeText}>EXPEDIENTE</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a expedientes"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <VerticeIcon name="back" color={colors.navy} size={18} />
          <Text style={styles.backText}>Volver a expedientes</Text>
        </Pressable>

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="case" color={colors.azure} size={24} />
            <Text style={styles.stateText}>Cargando expediente…</Text>
          </View>
        ) : null}

        {error ? (
          <Alert type="error" message={error} action={{ label: 'Reintentar', icon: 'refresh', onPress: () => void load() }} />
        ) : null}

        {item ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <VerticeIcon name="case" color={colors.white} size={27} />
              </View>
              <Text style={styles.eyebrow}>EXPEDIENTE CÍVICO</Text>
              <Text style={styles.title}>{item.report.title}</Text>
              <Text style={styles.heroMeta}>
                {item.report.category}{item.report.neighborhood ? ` · ${item.report.neighborhood}` : ''}
              </Text>
              <View style={styles.caseIdRow}>
                <Text style={styles.caseIdLabel}>CASE ID</Text>
                <Text selectable style={styles.caseId}>{item.id}</Text>
              </View>
            </View>

            <View style={styles.stageCard}>
              <View style={styles.stageHeading}>
                <VerticeIcon name="workflow" color={colors.citizen} size={22} />
                <View style={styles.stageCopy}>
                  <Text style={styles.stageLabel}>ETAPA ACTUAL DEL SERVIDOR</Text>
                  <Text style={styles.stageValue}>{STAGE_LABELS[item.stage] ?? item.stage}</Text>
                </View>
              </View>
              {item.stored_stage !== item.stage ? (
                <View style={styles.serverNote}>
                  <Text style={styles.serverNoteLabel}>Etapa persistida</Text>
                  <Text style={styles.serverNoteValue}>{STAGE_LABELS[item.stored_stage] ?? item.stored_stage}</Text>
                </View>
              ) : null}
              <Text style={styles.boundary}>
                El backend conserva la autoridad sobre el estado administrativo. Esta pantalla no calcula autoridad, elegibilidad, decisiones ni transiciones localmente.
              </Text>
            </View>

            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}>
                <VerticeIcon name="history" color={colors.navy} size={20} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionKicker}>TRAZABILIDAD</Text>
                <Text style={styles.sectionTitle}>Registro temporal</Text>
              </View>
            </View>

            <View style={styles.historyCard}>
              <View style={styles.historyRow}>
                <VerticeIcon name="report" color={colors.infoText} size={18} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyLabel}>Reporte de origen</Text>
                  <Text style={styles.historyValue}>{formatDate(item.report.created_at)}</Text>
                </View>
              </View>
              <View style={styles.historyDivider} />
              <View style={styles.historyRow}>
                <VerticeIcon name="case" color={colors.infoText} size={18} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyLabel}>Expediente creado</Text>
                  <Text style={styles.historyValue}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
              <View style={styles.historyDivider} />
              <View style={styles.historyRow}>
                <VerticeIcon name="refresh" color={colors.infoText} size={18} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyLabel}>Última actualización registrada</Text>
                  <Text style={styles.historyValue}>{formatDate(item.updated_at)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}>
                <VerticeIcon name="document" color={colors.navy} size={20} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionKicker}>ARTEFACTOS PERSISTIDOS</Text>
                <Text style={styles.sectionTitle}>Evidencia del flujo</Text>
              </View>
            </View>

            <View style={styles.artifacts}>
              <ArtifactStep title="Reporte" complete detail={`Estado: ${item.report.status}`} icon="report" />
              <ArtifactStep
                title="Análisis territorial"
                complete={Boolean(item.analysis)}
                detail={item.analysis ? `Audit ID: ${item.analysis.audit_id}` : 'El servidor aún no expone análisis territorial persistido.'}
                icon="pending"
              />
              <ArtifactStep
                title="Propuesta"
                complete={Boolean(item.proposal)}
                detail={item.proposal ? `${item.proposal.title ?? 'Propuesta'} · ${item.proposal.status ?? 'sin estado'}` : 'El servidor aún no expone una propuesta vinculada.'}
                icon="pending"
              />
              <ArtifactStep
                title="Control ciudadano"
                complete={Boolean(item.control)}
                detail={item.control ? `${item.control.legal_type ?? 'Actuación'} · ${item.control.status ?? 'sin estado'}` : 'El servidor aún no expone una actuación de control vinculada.'}
                icon="pending"
              />
            </View>

            {item.proposal ? (
              <View style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <VerticeIcon name="document" color={colors.navy} size={20} />
                  <Text style={styles.documentTitle}>Propuesta vinculada</Text>
                </View>
                <Text style={styles.documentName}>{item.proposal.title ?? 'Propuesta sin título'}</Text>
                <Text style={styles.documentMeta}>Estado: {item.proposal.status ?? 'sin estado'}</Text>
                {item.proposal.scope ? <Text style={styles.documentMeta}>Alcance: {item.proposal.scope}</Text> : null}
                {item.proposal.voting_ends_at ? <Text style={styles.documentMeta}>Cierre de votación: {formatDate(item.proposal.voting_ends_at)}</Text> : null}
                {item.proposal.policy_draft_audit_id ? (
                  <Text selectable style={styles.auditId}>Audit: {item.proposal.policy_draft_audit_id}</Text>
                ) : null}
              </View>
            ) : null}

            {item.control ? (
              <View style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <VerticeIcon name="shield" color={colors.navy} size={20} />
                  <Text style={styles.documentTitle}>Actuación de control</Text>
                </View>
                <Text style={styles.documentName}>{item.control.legal_type ?? 'Actuación de control'}</Text>
                <Text style={styles.documentMeta}>Estado: {item.control.status ?? 'sin estado'}</Text>
                {item.control.urgency ? <Text style={styles.documentMeta}>Urgencia: {item.control.urgency}</Text> : null}
                {item.control.submitted_at ? <Text style={styles.documentMeta}>Radicada: {formatDate(item.control.submitted_at)}</Text> : null}
                <Text selectable style={styles.auditId}>ID: {item.control.id}</Text>
              </View>
            ) : null}

            <View style={styles.requirementCard}>
              <VerticeIcon name="required" color={colors.warningText} size={22} />
              <View style={styles.requirementCopy}>
                <Text style={styles.requirementKicker}>VISIBILIDAD DEL EXPEDIENTE</Text>
                <Text style={styles.requirementText}>{artifactVisibilityMessage(item)}</Text>
                <Text style={styles.requirementBoundary}>
                  Esta lectura es informativa: la ausencia de un artefacto no implica orden secuencial ni autoriza una transición administrativa.
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir reporte de origen"
              onPress={() => router.push(`/report/${item.report.id}`)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <VerticeIcon name="report" color={colors.navy} size={19} />
              <Text style={styles.primaryButtonText}>Abrir reporte de origen</Text>
              <VerticeIcon name="chevronRight" color={colors.navy} size={18} />
            </Pressable>
          </>
        ) : null}
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
  stateCard: { minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateText: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  heroMeta: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  caseIdRow: { marginTop: spacing.xs, gap: spacing.xxs },
  caseIdLabel: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  caseId: { color: colors.white, fontFamily: typography.monoFamily, ...typography.roles.mono },
  stageCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...elevation.card },
  stageHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stageCopy: { flex: 1, gap: spacing.xxs },
  stageLabel: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  stageValue: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  serverNote: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceAlt, gap: spacing.xxs },
  serverNoteLabel: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  serverNoteValue: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  boundary: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sectionCopy: { flex: 1, gap: spacing.xxs },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  historyCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyCopy: { flex: 1, gap: spacing.xxs },
  historyLabel: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  historyValue: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  historyDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm, marginLeft: 30 },
  artifacts: { gap: spacing.sm },
  artifactCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  artifactCardComplete: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  artifactIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  artifactIconComplete: { backgroundColor: colors.surface },
  artifactCopy: { flex: 1, gap: spacing.xxs },
  artifactTitle: { color: colors.textSecondary, fontFamily: typography.bodyBoldFamily, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  artifactTitleComplete: { color: colors.successText },
  artifactDetail: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 18 },
  documentCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  documentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  documentTitle: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  documentName: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  documentMeta: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  auditId: { color: colors.textTertiary, fontFamily: typography.monoFamily, ...typography.roles.mono },
  requirementCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder },
  requirementCopy: { flex: 1, gap: spacing.xxs },
  requirementKicker: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  requirementText: { color: colors.warningText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  requirementBoundary: { color: colors.warningText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.citizen, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  pressed: { opacity: interaction.pressedOpacity },
})

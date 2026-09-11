import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { CitizenDashboard, MyTerritory } from '../../types/api'

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

const ACTIVATION_LABEL: Record<string, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

export default function DashboardScreen() {
  const [dashboard, setDashboard] = useState<CitizenDashboard | null>(null)
  const [territory, setTerritory] = useState<MyTerritory | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextDashboard, nextTerritory] = await Promise.all([
        apiFetch<CitizenDashboard>('/dashboard/me'),
        apiFetch<MyTerritory>('/territories/me'),
      ])
      setDashboard(nextDashboard)
      setTerritory(nextTerritory)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el panel.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        )}
      >
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={126} />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>RED CÍVICA</Text>
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>CENTRO DE MANDO CIUDADANO</Text>
          <Text style={styles.title}>Tu actividad cívica, en un solo lugar.</Text>
          <Text style={styles.subtitle}>{dashboard?.profile.neighborhood ?? territory?.territory_name ?? 'Colombia'}</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos actualizar el panel</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.territoryCard}>
          <View style={styles.cardAccent} />
          <Text style={styles.sectionKicker}>TU TERRITORIO</Text>
          {territory?.territory_code ? (
            <>
              <Text style={styles.territoryName}>{territory.territory_name ?? 'Municipio vinculado'}</Text>
              <Text style={styles.territoryMeta}>
                {territory.department_name ?? 'Colombia'} · {ACTIVATION_LABEL[territory.activation_status ?? ''] ?? territory.activation_status ?? 'Disponible'}
              </Text>
              <View style={styles.territoryActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/city/[code]', params: { code: territory.territory_code! } })}
                  style={({ pressed }) => [styles.territoryPrimary, pressed && styles.pressed]}
                >
                  <Text style={styles.territoryPrimaryText}>Ver nodo público</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/territory/activate')}
                  style={({ pressed }) => [styles.territorySecondary, pressed && styles.pressed]}
                >
                  <Text style={styles.territorySecondaryText}>Quiero ayudar</Text>
                </Pressable>
              </View>
              <Text style={styles.territoryBoundary}>Vinculación autodeclarada: no equivale a residencia cívica verificada ni concede autoridad.</Text>
            </>
          ) : (
            <>
              <Text style={styles.territoryName}>Aún no has vinculado una ciudad</Text>
              <Text style={styles.territoryMeta}>La activación comunitaria requiere asociar primero un municipio o distrito a tu cuenta.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/territory/activate')}
                style={({ pressed }) => [styles.territoryPrimary, pressed && styles.pressed]}
              >
                <Text style={styles.territoryPrimaryText}>Revisar activación territorial</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.reputationCard}>
          <Text style={styles.sectionKickerLight}>REPUTACIÓN</Text>
          <View style={styles.reputationRow}>
            <Text style={styles.reputationScore}>{dashboard?.reputation.score ?? '—'}</Text>
            <View style={styles.reputationCopy}>
              <Text style={styles.reputationLevel}>{dashboard?.reputation.level ?? 'Cargando…'}</Text>
              <Text style={styles.mutedLight}>Nivel de confianza cívica</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requiere tu atención</Text>
          <View style={styles.attentionCard}>
            <View style={styles.attentionHeader}>
              <Text style={styles.attentionValue}>{dashboard?.attention.total_items ?? 0}</Text>
              <Text style={styles.attentionLabel}>elementos pendientes</Text>
            </View>
            <View style={styles.attentionDetails}>
              <Text style={styles.detail}>Votaciones · {dashboard?.attention.pending_votes.length ?? 0}</Text>
              <Text style={styles.detail}>Evidencias · {dashboard?.attention.civic_actions_needing_evidence ?? 0}</Text>
              <Text style={styles.detail}>Reportes en curso · {dashboard?.attention.reports_in_progress ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continúa tu gestión</Text>
          <View style={styles.launchGrid}>
            <Pressable onPress={() => router.push('/workflows')} style={({ pressed }) => [styles.launchCard, pressed && styles.pressed]}>
              <Text style={styles.launchKicker}>GESTIÓN</Text>
              <Text style={styles.launchTitle}>Expedientes</Text>
              <Text style={styles.launchBody}>Sigue reportes, análisis, propuestas y control.</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/identity')} style={({ pressed }) => [styles.launchCard, pressed && styles.pressed]}>
              <Text style={styles.launchKicker}>IDENTIDAD</Text>
              <Text style={styles.launchTitle}>Identidad cívica</Text>
              <Text style={styles.launchBody}>Consulta assurance, proofing y proveedor.</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/crowdfunding')} style={({ pressed }) => [styles.launchCardWide, pressed && styles.pressed]}>
              <Text style={styles.launchKicker}>FINANCIACIÓN CÍVICA</Text>
              <Text style={styles.launchTitle}>Crowdfunding</Text>
              <Text style={styles.launchBody}>Revisa campañas, readiness y bloqueos financieros sin mover dinero desde el cliente.</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tu gestión</Text>
          <View style={styles.metricsGrid}>
            <MetricCard label="Acciones cívicas" value={dashboard?.mine.civic_actions.total ?? 0} />
            <MetricCard label="Acciones verificadas" value={dashboard?.mine.civic_actions.verified ?? 0} />
            <MetricCard label="Reportes" value={dashboard?.mine.reports.total ?? 0} />
            <MetricCard label="Propuestas" value={dashboard?.mine.proposals.total ?? 0} />
            <MetricCard label="Trámites legales" value={dashboard?.mine.legal.total ?? 0} />
            <MetricCard label="Flujos activos" value={dashboard?.mine.workflows.active ?? 0} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.xl },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.emerald },
  liveBadgeText: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.hero },
  subtitle: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.subtitle },
  errorCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.errorBorder, padding: spacing.md, backgroundColor: colors.errorBackground, gap: spacing.xxs },
  errorTitle: { color: colors.errorText, fontFamily: typography.bodyFamily, fontWeight: '800' },
  errorText: { color: colors.errorText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  territoryCard: { overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.xs, ...elevation.card },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.citizen },
  territoryName: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  territoryMeta: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  territoryActions: { marginTop: spacing.xs, flexDirection: 'row', gap: spacing.sm },
  territoryPrimary: { flex: 1, minHeight: interaction.buttonHeight, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy, paddingHorizontal: spacing.sm },
  territoryPrimaryText: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.button, textAlign: 'center' },
  territorySecondary: { flex: 1, minHeight: interaction.buttonHeight, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  territorySecondaryText: { color: colors.navy, fontFamily: typography.bodyFamily, ...typography.roles.button, textAlign: 'center' },
  territoryBoundary: { marginTop: spacing.xxs, color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 11, lineHeight: 16 },
  reputationCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.navy, gap: spacing.md, ...elevation.card },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.label },
  sectionKickerLight: { color: colors.citizen, fontFamily: typography.bodyFamily, ...typography.roles.label },
  reputationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  reputationScore: { color: colors.white, fontFamily: typography.displayFamily, fontSize: 44, lineHeight: 50, fontWeight: '800' },
  reputationCopy: { flex: 1, gap: spacing.xxs },
  reputationLevel: { color: colors.white, fontFamily: typography.displayFamily, fontSize: 18, fontWeight: '800' },
  mutedLight: { color: colors.borderActive, fontFamily: typography.bodyFamily, ...typography.roles.caption },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 20, fontWeight: '800' },
  attentionCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warningBorder, padding: spacing.lg, backgroundColor: colors.warningBackground, gap: spacing.md },
  attentionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  attentionValue: { color: colors.warningText, fontFamily: typography.displayFamily, fontSize: 36, fontWeight: '800' },
  attentionLabel: { color: colors.warningText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  attentionDetails: { gap: spacing.xs },
  detail: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  launchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  launchCard: { width: '48%', minHeight: 128, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surface, gap: spacing.xs },
  launchCardWide: { width: '100%', minHeight: 108, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.infoBorder, padding: spacing.md, backgroundColor: colors.infoBackground, gap: spacing.xs },
  launchKicker: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  launchTitle: { color: colors.navy, fontFamily: typography.displayFamily, fontSize: 16, fontWeight: '800' },
  launchBody: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '48%', minHeight: 110, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surface, gap: spacing.xs },
  metricValue: { color: colors.navy, fontFamily: typography.displayFamily, fontSize: 28, fontWeight: '800' },
  metricLabel: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 18 },
  pressed: { opacity: interaction.pressedOpacity },
})

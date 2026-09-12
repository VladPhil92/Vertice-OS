import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../providers/AuthProvider'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { PublicCityFeedItem, PublicCityOverview, TerritoryActivationStatus, TerritoryLaunchState } from '../../types/api'

const ACTIVATION_LABEL: Record<TerritoryActivationStatus, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

const LAUNCH_LABEL: Record<TerritoryLaunchState, string> = {
  observing: 'Observando señales locales',
  recruiting: 'Convocando comunidad',
  launch_ready: 'Lista para lanzamiento',
  launched: 'Nodo lanzado',
  paused: 'Activación pausada',
}

interface ActivityItem extends PublicCityFeedItem {
  kind: 'Acción' | 'Reporte' | 'Propuesta'
}

function activationTone(status: TerritoryActivationStatus) {
  if (status === 'verified_network') return styles.statusSuccess
  if (status === 'pilot_ready' || status === 'community_active') return styles.statusInfo
  if (status === 'emerging') return styles.statusWarning
  return styles.statusNeutral
}

function launchTone(status: TerritoryLaunchState) {
  if (status === 'launched' || status === 'launch_ready') return styles.statusSuccess
  if (status === 'recruiting') return styles.statusInfo
  if (status === 'paused') return styles.statusWarning
  return styles.statusNeutral
}

function activityIcon(kind: ActivityItem['kind']) {
  if (kind === 'Reporte') return 'report' as const
  if (kind === 'Propuesta') return 'governance' as const
  return 'actions' as const
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

export default function PublicCityScreen() {
  const { user, loading: authLoading } = useAuth()
  const params = useLocalSearchParams<{ code?: string | string[] }>()
  const code = useMemo(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code
    return raw ? decodeURIComponent(raw) : ''
  }, [params.code])
  const [overview, setOverview] = useState<PublicCityOverview | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!code) {
      setError('Nodo territorial inválido.')
      setLoading(false)
      return
    }
    setError(null)
    try {
      setOverview(await apiFetch<PublicCityOverview>(`/territories/public/${encodeURIComponent(code)}?feed_limit=6`, { public: true }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar esta ciudad.')
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => { void load() }, [load])

  const activity = useMemo<ActivityItem[]>(() => {
    if (!overview) return []
    return [
      ...overview.feed.actions.map((item) => ({ ...item, kind: 'Acción' as const })),
      ...overview.feed.reports.map((item) => ({ ...item, kind: 'Reporte' as const })),
      ...overview.feed.proposals.map((item) => ({ ...item, kind: 'Propuesta' as const })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12)
  }, [overview])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  function openActivation() {
    if (authLoading) return
    if (user) {
      router.push('/territory/activate')
      return
    }
    router.push({ pathname: '/(auth)/sign-in', params: { next: 'territory-activate' } })
  }

  function openActivity(item: ActivityItem) {
    if (item.kind === 'Reporte') {
      router.push({ pathname: '/report/[id]', params: { id: item.id } })
    }
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
            <VerticeIcon name="territory" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>NODO PÚBLICO</Text>
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

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="territory" color={colors.azure} size={24} />
            <Text style={styles.muted}>Cargando nodo territorial…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos cargar la ciudad</Text>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <VerticeIcon name="refresh" color={colors.navy} size={18} />
              <Text style={styles.secondaryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {overview ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <VerticeIcon name="territory" color={colors.white} size={24} />
              </View>
              <Text style={styles.eyebrow}>NODO VÉRTICE · COLOMBIA</Text>
              <Text style={styles.title}>{overview.territory.name}</Text>
              <View style={styles.heroStatusRow}>
                <View style={[styles.statusPill, activationTone(overview.territory.activation_status)]}>
                  <Text style={styles.statusPillText}>{ACTIVATION_LABEL[overview.territory.activation_status]}</Text>
                </View>
                {overview.territory.external_code ? <Text style={styles.heroMeta}>DANE {overview.territory.external_code}</Text> : null}
              </View>
              <View style={styles.momentumRow}>
                <Text style={styles.momentumValue}>{overview.activation.momentum_score}</Text>
                <View style={styles.momentumCopy}>
                  <Text style={styles.momentumLabel}>momentum cívico / 100</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(2, overview.activation.momentum_score))}%` }]} />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <Metric label="Ciudadanía activa · 30d" value={overview.activation.active_citizens_30d} />
              <Metric label="Acciones cívicas · 30d" value={overview.activation.civic_actions_30d} />
              <Metric label="Acciones verificadas · 90d" value={overview.activation.verified_actions_90d} />
              <Metric label="Propuestas · 30d" value={overview.activation.proposals_30d} />
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}>
                  <VerticeIcon name="community" color={colors.navy} size={20} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionKicker}>ACTIVACIÓN LOCAL</Text>
                  <Text style={styles.sectionTitle}>{LAUNCH_LABEL[overview.launch.operational_state]}</Text>
                </View>
              </View>
              <View style={[styles.statusBanner, launchTone(overview.launch.operational_state)]}>
                <Text style={styles.statusBannerText}>
                  Este estado describe madurez operativa de comunidad. No concede autoridad política, identidad verificada, reputación adicional ni peso de voto.
                </Text>
              </View>
              <View style={styles.inlineMetrics}>
                <View style={styles.inlineMetric}>
                  <Text style={styles.inlineMetricValue}>{overview.launch.active_cohort_members}</Text>
                  <Text style={styles.inlineMetricLabel}>Cohorte activa</Text>
                </View>
                <View style={styles.inlineMetric}>
                  <Text style={styles.inlineMetricValue}>{overview.launch.pending_interest_count}</Text>
                  <Text style={styles.inlineMetricLabel}>Personas interesadas</Text>
                </View>
              </View>
              {overview.launch.accepting_interest ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: authLoading }}
                  disabled={authLoading}
                  onPress={openActivation}
                  style={({ pressed }) => [styles.primaryButton, authLoading && styles.disabled, pressed && !authLoading && styles.pressed]}
                >
                  <VerticeIcon name="community" color={colors.navy} size={18} />
                  <Text style={styles.primaryButtonText}>{user ? 'Quiero ayudar a activar mi ciudad' : 'Iniciar sesión para ayudar'}</Text>
                </Pressable>
              ) : (
                <View style={styles.pausedCard}>
                  <Text style={styles.pausedText}>La recepción de nuevas manifestaciones está temporalmente pausada.</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}>
                  <VerticeIcon name="signal" color={colors.navy} size={20} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionKicker}>ACTIVIDAD PÚBLICA</Text>
                  <Text style={styles.sectionTitle}>Lo más reciente en {overview.territory.name}</Text>
                </View>
              </View>
              {activity.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.empty}>{overview.feed.empty_state ?? 'Todavía no hay actividad pública.'}</Text>
                </View>
              ) : (
                <View style={styles.activityList}>
                  {activity.map((item) => {
                    const content = (
                      <>
                        <View style={styles.activityIcon}>
                          <VerticeIcon name={activityIcon(item.kind)} color={colors.navy} size={18} />
                        </View>
                        <View style={styles.activityCopy}>
                          <Text style={styles.activityMeta}>{item.kind.toUpperCase()} · {item.category} · {item.status}</Text>
                          <Text style={styles.activityTitle}>{item.title}</Text>
                          <Text style={styles.activityDate}>{new Date(item.created_at).toLocaleDateString('es-CO')}</Text>
                        </View>
                        {item.kind === 'Reporte' ? <VerticeIcon name="chevronRight" color={colors.textTertiary} size={18} /> : null}
                      </>
                    )

                    return item.kind === 'Reporte' ? (
                      <Pressable
                        key={`${item.kind}-${item.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir reporte ${item.title}`}
                        onPress={() => openActivity(item)}
                        style={({ pressed }) => [styles.activityItem, pressed && styles.pressed]}
                      >
                        {content}
                      </Pressable>
                    ) : (
                      <View key={`${item.kind}-${item.id}`} style={styles.activityItem}>{content}</View>
                    )
                  })}
                </View>
              )}
            </View>

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryKicker}>FRONTERA DE SEÑAL</Text>
              <Text style={styles.boundaryText}>
                El momentum usa participación y evidencia cívica. Pagos, donaciones, payouts, suscripciones, KYC/KYB, capacidad económica e ideología están fuera del cálculo.
              </Text>
            </View>
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
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  stateCard: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, gap: spacing.sm },
  errorTitle: { color: colors.errorText, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  errorText: { color: colors.errorText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  heroMeta: { color: colors.white, fontFamily: typography.monoFamily, ...typography.roles.mono },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusPillText: { color: colors.textPrimary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  momentumRow: { marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  momentumValue: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, fontSize: 44, lineHeight: 50, fontWeight: '800' },
  momentumCopy: { flex: 1, gap: spacing.xs },
  momentumLabel: { color: colors.white, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.navyLight },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.citizen },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '48%', minHeight: 108, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  metricValue: { fontFamily: typography.displayExtraBoldFamily, fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.navy },
  metricLabel: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sectionCopy: { flex: 1, gap: spacing.xxs },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  statusBanner: { borderRadius: radius.md, borderWidth: 1, padding: spacing.sm },
  statusBannerText: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  statusSuccess: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  statusInfo: { backgroundColor: colors.infoBackground, borderColor: colors.infoBorder },
  statusWarning: { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder },
  statusNeutral: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  inlineMetrics: { flexDirection: 'row', gap: spacing.sm },
  inlineMetric: { flex: 1, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surfaceAlt, gap: spacing.xxs },
  inlineMetricValue: { color: colors.navy, fontFamily: typography.displayExtraBoldFamily, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  inlineMetricLabel: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', gap: spacing.xs, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.citizen, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button, textAlign: 'center' },
  pausedCard: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder },
  pausedText: { color: colors.warningText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  emptyCard: { borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  empty: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  activityList: { gap: spacing.sm },
  activityItem: { minHeight: 84, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  activityIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  activityCopy: { flex: 1, gap: spacing.xxs },
  activityMeta: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.6 },
  activityTitle: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  activityDate: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  boundaryCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, gap: spacing.xs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

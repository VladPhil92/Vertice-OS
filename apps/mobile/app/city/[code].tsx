import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../providers/AuthProvider'
import type { PublicCityFeedItem, PublicCityOverview } from '../../types/api'

const ACTIVATION_LABEL: Record<string, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

const LAUNCH_LABEL: Record<string, string> = {
  observing: 'Observando señales locales',
  recruiting: 'Convocando comunidad',
  launch_ready: 'Lista para lanzamiento',
  launched: 'Nodo lanzado',
  paused: 'Activación pausada',
}

interface ActivityItem extends PublicCityFeedItem {
  kind: 'Acción' | 'Reporte' | 'Propuesta'
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
    if (!code) return
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>

        {loading ? <Text style={styles.muted}>Cargando nodo territorial…</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos cargar la ciudad</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {overview ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>NODO VÉRTICE · COLOMBIA</Text>
              <Text style={styles.title}>{overview.territory.name}</Text>
              <Text style={styles.subtitle}>
                {ACTIVATION_LABEL[overview.territory.activation_status] ?? overview.territory.activation_status}
                {overview.territory.external_code ? ` · DANE ${overview.territory.external_code}` : ''}
              </Text>
              <View style={styles.momentumRow}>
                <Text style={styles.momentumValue}>{overview.activation.momentum_score}</Text>
                <View style={styles.momentumCopy}>
                  <Text style={styles.momentumLabel}>momentum cívico / 100</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(2, overview.activation.momentum_score)}%` }]} />
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
              <Text style={styles.sectionKicker}>ACTIVACIÓN LOCAL</Text>
              <Text style={styles.sectionTitle}>{LAUNCH_LABEL[overview.launch.operational_state] ?? overview.launch.operational_state}</Text>
              <Text style={styles.body}>
                Este estado describe madurez operativa de comunidad. No concede autoridad política, identidad verificada, reputación adicional ni peso de voto.
              </Text>
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
                <Pressable accessibilityRole="button" disabled={authLoading} onPress={openActivation} style={[styles.primaryButton, authLoading && styles.disabled]}>
                  <Text style={styles.primaryButtonText}>{user ? 'Quiero ayudar a activar mi ciudad' : 'Iniciar sesión para ayudar'}</Text>
                </Pressable>
              ) : (
                <View style={styles.pausedCard}>
                  <Text style={styles.pausedText}>La recepción de nuevas manifestaciones está temporalmente pausada.</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionKicker}>ACTIVIDAD PÚBLICA</Text>
              <Text style={styles.sectionTitle}>Lo más reciente en {overview.territory.name}</Text>
              {activity.length === 0 ? (
                <Text style={styles.empty}>{overview.feed.empty_state ?? 'Todavía no hay actividad pública.'}</Text>
              ) : (
                <View style={styles.activityList}>
                  {activity.map((item) => (
                    <View key={`${item.kind}-${item.id}`} style={styles.activityItem}>
                      <Text style={styles.activityMeta}>{item.kind.toUpperCase()} · {item.category} · {item.status}</Text>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.activityDate}>{new Date(item.created_at).toLocaleDateString('es-CO')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryText}>
                <Text style={styles.boundaryStrong}>Frontera de señal. </Text>
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
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 44, gap: 18 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#24573E', fontWeight: '700' },
  muted: { color: '#6C7068' },
  errorCard: { borderRadius: 16, padding: 16, backgroundColor: '#FBE9E7', gap: 4 },
  errorTitle: { color: '#7C2D2D', fontWeight: '700' },
  errorText: { color: '#7C2D2D', lineHeight: 20 },
  hero: { borderRadius: 24, padding: 22, backgroundColor: '#17382A', gap: 8 },
  eyebrow: { color: '#C8D9CF', fontSize: 11, letterSpacing: 1.7, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '800' },
  subtitle: { color: '#D9E4DD', lineHeight: 20 },
  momentumRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  momentumValue: { color: '#FFFFFF', fontSize: 44, lineHeight: 50, fontWeight: '800' },
  momentumCopy: { flex: 1, gap: 8 },
  momentumLabel: { color: '#C8D9CF', fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: '#365847' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#FFFFFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 104, borderRadius: 18, padding: 15, backgroundColor: '#FFFFFF', gap: 6 },
  metricValue: { fontSize: 28, fontWeight: '800', color: '#1C3D2E' },
  metricLabel: { color: '#5E6259', lineHeight: 18, fontSize: 12 },
  card: { borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF', gap: 12 },
  sectionKicker: { color: '#697068', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  sectionTitle: { color: '#171A15', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  body: { color: '#5C625A', lineHeight: 21 },
  inlineMetrics: { flexDirection: 'row', gap: 10 },
  inlineMetric: { flex: 1, borderRadius: 16, padding: 14, backgroundColor: '#F1EFE8', gap: 3 },
  inlineMetricValue: { color: '#1C3D2E', fontSize: 22, fontWeight: '800' },
  inlineMetricLabel: { color: '#666B62', fontSize: 12 },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17382A', paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center' },
  pausedCard: { borderRadius: 14, padding: 14, backgroundColor: '#F1EFE8' },
  pausedText: { color: '#666B62', lineHeight: 20 },
  empty: { borderRadius: 14, padding: 14, backgroundColor: '#F1EFE8', color: '#666B62', lineHeight: 20 },
  activityList: { gap: 10 },
  activityItem: { borderRadius: 15, padding: 14, borderWidth: 1, borderColor: '#E7E4DB', gap: 5 },
  activityMeta: { color: '#74786F', fontSize: 10, letterSpacing: 0.8 },
  activityTitle: { color: '#1C211B', fontWeight: '700', lineHeight: 20 },
  activityDate: { color: '#84887F', fontSize: 12 },
  boundaryCard: { borderRadius: 18, padding: 17, backgroundColor: '#E7EFE9' },
  boundaryText: { color: '#3E5547', lineHeight: 21 },
  boundaryStrong: { fontWeight: '800' },
  disabled: { opacity: 0.5 },
})

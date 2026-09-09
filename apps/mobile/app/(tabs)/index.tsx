import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
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
                  style={styles.territoryPrimary}
                >
                  <Text style={styles.territoryPrimaryText}>Ver nodo público</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/territory/activate')}
                  style={styles.territorySecondary}
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
              <Pressable accessibilityRole="button" onPress={() => router.push('/territory/activate')} style={styles.territoryPrimary}>
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
              <Text style={styles.muted}>Nivel de confianza cívica</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requiere tu atención</Text>
          <View style={styles.attentionCard}>
            <Text style={styles.attentionValue}>{dashboard?.attention.total_items ?? 0}</Text>
            <Text style={styles.attentionLabel}>elementos pendientes</Text>
            <View style={styles.attentionDetails}>
              <Text style={styles.detail}>Votaciones: {dashboard?.attention.pending_votes.length ?? 0}</Text>
              <Text style={styles.detail}>Evidencias: {dashboard?.attention.civic_actions_needing_evidence ?? 0}</Text>
              <Text style={styles.detail}>Reportes en curso: {dashboard?.attention.reports_in_progress ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continúa tu gestión</Text>
          <View style={styles.launchGrid}>
            <Pressable onPress={() => router.push('/workflows')} style={styles.launchCard}>
              <Text style={styles.launchTitle}>Expedientes</Text>
              <Text style={styles.launchBody}>Sigue reportes, análisis, propuestas y control.</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/identity')} style={styles.launchCard}>
              <Text style={styles.launchTitle}>Identidad cívica</Text>
              <Text style={styles.launchBody}>Consulta assurance, proofing y proveedor.</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/crowdfunding')} style={styles.launchCardWide}>
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
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 40, gap: 24 },
  header: { paddingTop: 8, gap: 8 },
  eyebrow: { fontSize: 12, letterSpacing: 1.8, fontWeight: '700', color: '#697068' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: '#11130F' },
  subtitle: { fontSize: 15, color: '#6D7168' },
  errorCard: { borderRadius: 16, padding: 16, backgroundColor: '#FBE9E7', gap: 4 },
  errorTitle: { fontWeight: '700', color: '#7C2D2D' },
  errorText: { color: '#7C2D2D', lineHeight: 20 },
  territoryCard: { borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF', gap: 8 },
  territoryName: { color: '#171A15', fontSize: 23, lineHeight: 28, fontWeight: '800' },
  territoryMeta: { color: '#666B62', lineHeight: 20 },
  territoryActions: { marginTop: 8, flexDirection: 'row', gap: 10 },
  territoryPrimary: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17382A', paddingHorizontal: 10 },
  territoryPrimaryText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center' },
  territorySecondary: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#AEB7AF', paddingHorizontal: 10 },
  territorySecondaryText: { color: '#17382A', fontWeight: '800', textAlign: 'center' },
  territoryBoundary: { marginTop: 4, color: '#7C8178', fontSize: 11, lineHeight: 16 },
  reputationCard: { borderRadius: 22, padding: 20, backgroundColor: '#17382A', gap: 16 },
  sectionKicker: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#697068' },
  sectionKickerLight: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#C8D9CF' },
  reputationRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  reputationScore: { fontSize: 44, lineHeight: 50, fontWeight: '700', color: '#FFFFFF' },
  reputationCopy: { flex: 1, gap: 3 },
  reputationLevel: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  muted: { color: '#C8D9CF' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#151712' },
  attentionCard: { borderRadius: 20, padding: 18, backgroundColor: '#E7E4D8', gap: 4 },
  attentionValue: { fontSize: 36, fontWeight: '700', color: '#22251E' },
  attentionLabel: { color: '#595E55' },
  attentionDetails: { marginTop: 14, gap: 7 },
  detail: { color: '#363A32', lineHeight: 20 },
  launchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  launchCard: { width: '48%', minHeight: 118, borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 7 },
  launchCardWide: { width: '100%', minHeight: 100, borderRadius: 18, padding: 16, backgroundColor: '#E7E4D8', gap: 7 },
  launchTitle: { fontSize: 16, fontWeight: '800', color: '#17382A' },
  launchBody: { color: '#5E6259', lineHeight: 18, fontSize: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 110, borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 8 },
  metricValue: { fontSize: 28, fontWeight: '700', color: '#1C3D2E' },
  metricLabel: { color: '#5E6259', lineHeight: 18 },
})

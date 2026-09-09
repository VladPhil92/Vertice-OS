import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type { CitizenDashboard } from '../../types/api'

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

export default function DashboardScreen() {
  const [dashboard, setDashboard] = useState<CitizenDashboard | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [dashboardResponse, notificationResponse] = await Promise.all([
        apiFetch<CitizenDashboard>('/dashboard/me'),
        apiFetch<{ count: number }>('/notifications/unread-count'),
      ])
      setDashboard(dashboardResponse)
      setUnreadNotifications(notificationResponse.count)
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
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CENTRO DE MANDO CIUDADANO</Text>
            <Text style={styles.title}>Tu actividad cívica, en un solo lugar.</Text>
            <Text style={styles.subtitle}>{dashboard?.profile.neighborhood ?? 'Cartagena de Indias'}</Text>
          </View>
          <Pressable style={styles.notificationButton} onPress={() => router.push('/notifications' as never)}>
            <Text style={styles.notificationButtonLabel}>Avisos</Text>
            {unreadNotifications > 0 ? <Text style={styles.notificationBadge}>{unreadNotifications}</Text> : null}
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos actualizar el panel</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.reputationCard}>
          <Text style={styles.sectionKicker}>REPUTACIÓN</Text>
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
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  header: { flex: 1, paddingTop: 8, gap: 8 },
  eyebrow: { fontSize: 12, letterSpacing: 1.8, fontWeight: '700', color: '#697068' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: '#11130F' },
  subtitle: { fontSize: 15, color: '#6D7168' },
  notificationButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#DAD7CC' },
  notificationButtonLabel: { color: '#17382A', fontWeight: '700', fontSize: 12 },
  notificationBadge: { minWidth: 22, textAlign: 'center', backgroundColor: '#17382A', color: '#FFFFFF', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: '800' },
  errorCard: { borderRadius: 16, padding: 16, backgroundColor: '#FBE9E7', gap: 4 },
  errorTitle: { fontWeight: '700', color: '#7C2D2D' },
  errorText: { color: '#7C2D2D', lineHeight: 20 },
  reputationCard: { borderRadius: 22, padding: 20, backgroundColor: '#17382A', gap: 16 },
  sectionKicker: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#C8D9CF' },
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 110, borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 8 },
  metricValue: { fontSize: 28, fontWeight: '700', color: '#1C3D2E' },
  metricLabel: { color: '#5E6259', lineHeight: 18 },
})

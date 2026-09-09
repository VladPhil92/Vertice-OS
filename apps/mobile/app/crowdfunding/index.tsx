import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type { CrowdfundingReadiness, OwnCampaignsResponse } from '../../types/domain-parity'

function cop(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function StatePill({ label, value }: { label: string; value: string }) {
  const ready = value === 'ready' || value === 'verified'
  return (
    <View style={[styles.statePill, ready && styles.statePillReady]}>
      <Text style={styles.stateLabel}>{label}</Text>
      <Text style={[styles.stateValue, ready && styles.stateValueReady]}>{value}</Text>
    </View>
  )
}

export default function CrowdfundingScreen() {
  const [readiness, setReadiness] = useState<CrowdfundingReadiness | null>(null)
  const [campaigns, setCampaigns] = useState<OwnCampaignsResponse['campaigns']>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextReadiness, nextCampaigns] = await Promise.all([
        apiFetch<CrowdfundingReadiness>('/crowdfunding/me/readiness'),
        apiFetch<OwnCampaignsResponse>('/crowdfunding/me/campaigns'),
      ])
      setReadiness(nextReadiness)
      setCampaigns(nextCampaigns.campaigns)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar crowdfunding.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Volver</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>RECAUDO COMUNITARIO</Text>
          <Text style={styles.title}>Crowdfunding</Text>
          <Text style={styles.intro}>Seguimiento nativo de campañas y readiness. El móvil no decide elegibilidad financiera, no confirma settlement y no habilita dinero por estado local.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.summaryCard, readiness?.ready_for_campaign_activation && styles.summaryReady]}>
          <Text style={styles.summaryKicker}>READINESS GENERAL</Text>
          <Text style={styles.summaryValue}>{readiness?.ready_for_campaign_activation ? 'Listo para activación' : 'Acciones pendientes'}</Text>
          <Text style={styles.summaryBody}>Usuario: {readiness?.user_ready ? 'listo' : 'pendiente'} · Plataforma: {readiness?.platform_ready ? 'lista' : 'bloqueada/pendiente'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cadena de preparación</Text>
          <StatePill label="Identidad" value={readiness?.identity.state ?? '—'} />
          <StatePill label="Perfil de recaudo" value={readiness?.payout_profile.state ?? '—'} />
          <StatePill label="Destino de desembolso" value={readiness?.payout_destination.state ?? '—'} />
          <StatePill label="Cobro crowdfunding" value={readiness?.platform.crowdfunding_collection ?? '—'} />
          <StatePill label="Proveedor payout" value={readiness?.platform.payout_provider ?? '—'} />
          <StatePill label="Certificación payout" value={readiness?.platform.payout_certification ?? '—'} />
        </View>

        {readiness?.blockers.length ? (
          <View style={styles.blockersCard}>
            <Text style={styles.cardTitle}>Bloqueos actuales</Text>
            {readiness.blockers.map((blocker) => (
              <View key={`${blocker.scope}-${blocker.code}`} style={styles.blockerRow}>
                <Text style={styles.blockerScope}>{blocker.scope.toUpperCase()}</Text>
                <View style={styles.blockerCopy}>
                  <Text style={styles.blockerMessage}>{blocker.message}</Text>
                  <Text style={styles.blockerCode}>{blocker.code}</Text>
                </View>
              </View>
            ))}
            {readiness.blockers.some((item) => item.code === 'IDENTITY_VERIFICATION_REQUIRED') ? (
              <Pressable onPress={() => router.push('/identity')} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Revisar identidad cívica</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mis campañas</Text>
          {campaigns.map((campaign) => {
            const goal = Math.max(1, campaign.goal_amount_cop)
            const progress = Math.min(100, Math.round((campaign.raised_amount_cop / goal) * 100))
            const campaignReadiness = readiness?.campaigns.find((item) => item.id === campaign.id)
            return (
              <View key={campaign.id} style={styles.campaignCard}>
                <View style={styles.campaignTop}>
                  <Text style={styles.campaignTitle}>{campaign.title}</Text>
                  <Text style={styles.progress}>{progress}%</Text>
                </View>
                <Text style={styles.campaignMeta}>{campaign.category} · {campaign.status} · compliance {campaign.compliance_status}</Text>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
                <Text style={styles.amount}>{cop(campaign.raised_amount_cop)} de {cop(campaign.goal_amount_cop)}</Text>
                <Text style={styles.readinessLine}>Activable: {campaignReadiness?.can_activate ? 'sí' : 'no'} · Recaudo permitido: {campaignReadiness?.can_accept_contributions ? 'sí' : 'no'}</Text>
              </View>
            )
          })}
          {!error && campaigns.length === 0 ? <Text style={styles.empty}>Aún no tienes campañas creadas.</Text> : null}
        </View>

        <View style={styles.boundaryCard}>
          <Text style={styles.boundaryTitle}>Frontera financiera</Text>
          <Text style={styles.boundaryText}>Pagos, donaciones, KYC/KYB, suscripciones y payouts no modifican reputación, ranking, voto ni autoridad cívica. Los proveedores y feature flags del servidor siguen siendo la fuente de verdad.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#B9BDB5' },
  backText: { color: '#17382A', fontWeight: '700' },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#697068' },
  title: { fontSize: 30, fontWeight: '800', color: '#11130F' },
  intro: { color: '#5E6259', lineHeight: 20 },
  summaryCard: { borderRadius: 20, padding: 18, backgroundColor: '#725329', gap: 5 },
  summaryReady: { backgroundColor: '#17382A' },
  summaryKicker: { color: '#E8DFC9', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  summaryValue: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  summaryBody: { color: '#F0E9D9' },
  card: { borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171A15' },
  statePill: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderRadius: 12, padding: 11, backgroundColor: '#F2EFE8' },
  statePillReady: { backgroundColor: '#E5F0E9' },
  stateLabel: { color: '#4E544C', flex: 1 },
  stateValue: { color: '#7B5B36', fontWeight: '800', fontSize: 12 },
  stateValueReady: { color: '#17382A' },
  blockersCard: { borderRadius: 18, padding: 16, backgroundColor: '#FBF2DC', gap: 12 },
  blockerRow: { flexDirection: 'row', gap: 10 },
  blockerScope: { width: 66, color: '#8A6818', fontSize: 10, fontWeight: '800' },
  blockerCopy: { flex: 1, gap: 3 },
  blockerMessage: { color: '#5D4B22', lineHeight: 18 },
  blockerCode: { color: '#927A48', fontSize: 10 },
  secondaryButton: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#A88942', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#5D4B22', fontWeight: '800' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#171A15' },
  campaignCard: { borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 8 },
  campaignTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  campaignTitle: { flex: 1, color: '#171A15', fontSize: 16, fontWeight: '800' },
  progress: { color: '#17382A', fontWeight: '800' },
  campaignMeta: { color: '#6D7168', fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#E8E5DC', overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#17382A' },
  amount: { color: '#3F453D', fontWeight: '700' },
  readinessLine: { color: '#6D7168', fontSize: 12 },
  boundaryCard: { borderRadius: 16, padding: 15, backgroundColor: '#E7E4D8', gap: 5 },
  boundaryTitle: { color: '#30352E', fontWeight: '800' },
  boundaryText: { color: '#5D625A', lineHeight: 18, fontSize: 12 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { color: '#777B74', textAlign: 'center', paddingVertical: 24 },
})

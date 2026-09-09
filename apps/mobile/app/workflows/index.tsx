import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
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
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/workflows/${item.id}`)}>
      <View style={styles.cardTop}>
        <Text style={styles.stage}>{STAGE_LABELS[item.stage] ?? item.stage}</Text>
        <Text style={styles.status}>{item.report.status}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.report.title}</Text>
      <Text style={styles.meta}>{item.report.category}{item.report.neighborhood ? ` · ${item.report.neighborhood}` : ''}</Text>
      <View style={styles.linksRow}>
        <Text style={styles.linkState}>{item.analysis ? '✓ análisis' : '○ análisis'}</Text>
        <Text style={styles.linkState}>{item.proposal ? '✓ propuesta' : '○ propuesta'}</Text>
        <Text style={styles.linkState}>{item.control ? '✓ control' : '○ control'}</Text>
      </View>
    </Pressable>
  )
}

export default function WorkflowsScreen() {
  const [items, setItems] = useState<CivicCase[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<CivicCaseListResponse>('/workflows/cases?limit=50')
      setItems(response.data)
    } catch (cause) {
      setItems([])
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tus expedientes.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Volver</Text></Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>CONTINUIDAD CÍVICA</Text>
            <Text style={styles.title}>Expedientes</Text>
          </View>
        </View>
        <Text style={styles.intro}>Sigue el recorrido de tus reportes desde la evidencia territorial hasta propuesta, deliberación o control ciudadano. La autoridad del estado permanece en la API.</Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No disponible</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Los expedientes requieren una cuenta verificada.</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => <CaseCard key={item.id} item={item} />)}
          {!error && items.length === 0 ? <Text style={styles.empty}>Aún no tienes expedientes cívicos.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#B9BDB5' },
  backText: { color: '#17382A', fontWeight: '700' },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#697068' },
  title: { fontSize: 30, fontWeight: '800', color: '#11130F' },
  intro: { color: '#5E6259', lineHeight: 20 },
  list: { gap: 12 },
  card: { borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  stage: { color: '#17382A', fontWeight: '800', fontSize: 12 },
  status: { color: '#72766E', fontSize: 12 },
  cardTitle: { color: '#171A15', fontSize: 17, fontWeight: '700' },
  meta: { color: '#6D7168' },
  linksRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 4 },
  linkState: { fontSize: 12, color: '#526258' },
  errorCard: { borderRadius: 16, padding: 15, backgroundColor: '#FBE9E7', gap: 5 },
  errorTitle: { fontWeight: '800', color: '#7C2D2D' },
  errorText: { color: '#7C2D2D', lineHeight: 19 },
  errorHint: { color: '#85534E', fontSize: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 30 },
})

import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type { CivicCase } from '../../types/domain-parity'

function Step({ title, active, detail }: { title: string; active: boolean; detail: string }) {
  return (
    <View style={[styles.step, active && styles.stepActive]}>
      <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{active ? '✓ ' : '○ '}{title}</Text>
      <Text style={styles.stepDetail}>{detail}</Text>
    </View>
  )
}

export default function WorkflowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [item, setItem] = useState<CivicCase | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setItem(await apiFetch<CivicCase>(`/workflows/cases/${encodeURIComponent(id)}`))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el expediente.')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Volver a expedientes</Text></Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {item ? (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>EXPEDIENTE CÍVICO</Text>
              <Text style={styles.title}>{item.report.title}</Text>
              <Text style={styles.meta}>{item.report.category}{item.report.neighborhood ? ` · ${item.report.neighborhood}` : ''}</Text>
            </View>

            <View style={styles.stageCard}>
              <Text style={styles.stageLabel}>Etapa actual</Text>
              <Text style={styles.stageValue}>{item.stage}</Text>
              <Text style={styles.boundary}>Esta pantalla representa estado canónico de servidor; no calcula autoridad, elegibilidad ni resultados localmente.</Text>
            </View>

            <View style={styles.timeline}>
              <Step title="Reporte" active detail={`Estado: ${item.report.status}`} />
              <Step title="Análisis" active={Boolean(item.analysis)} detail={item.analysis ? `Audit: ${item.analysis.audit_id}` : 'Aún no existe análisis territorial persistido.'} />
              <Step title="Propuesta" active={Boolean(item.proposal)} detail={item.proposal ? `${item.proposal.title ?? 'Propuesta'} · ${item.proposal.status ?? 'sin estado'}` : 'Aún no hay propuesta vinculada.'} />
              <Step title="Control" active={Boolean(item.control)} detail={item.control ? `${item.control.legal_type ?? 'Actuación'} · ${item.control.status ?? 'sin estado'}` : 'Aún no hay actuación de control vinculada.'} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/report/${item.report.id}`)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Abrir reporte de origen</Text>
            </Pressable>
          </>
        ) : null}
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
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#11130F' },
  meta: { color: '#6D7168' },
  stageCard: { borderRadius: 20, padding: 18, backgroundColor: '#17382A', gap: 5 },
  stageLabel: { color: '#C8D9CF', fontSize: 12, fontWeight: '700' },
  stageValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  boundary: { color: '#C8D9CF', fontSize: 11, lineHeight: 16, marginTop: 6 },
  timeline: { gap: 10 },
  step: { borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#D7D4CA', backgroundColor: '#FFFFFF', gap: 5 },
  stepActive: { borderColor: '#8CAC99', backgroundColor: '#EEF3EF' },
  stepTitle: { color: '#62675F', fontWeight: '800' },
  stepTitleActive: { color: '#17382A' },
  stepDetail: { color: '#62675F', lineHeight: 18, fontSize: 12 },
  primaryButton: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17382A' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
})

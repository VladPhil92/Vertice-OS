import { useCallback, useEffect, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type { TerritorialReportDetail } from '../../types/api'

export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const reportId = Array.isArray(params.id) ? params.id[0] : params.id
  const [report, setReport] = useState<TerritorialReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!reportId) {
      setError('Reporte inválido.')
      setLoading(false)
      return
    }

    setError(null)
    setLoading(true)
    try {
      setReport(await apiFetch<TerritorialReportDetail>(`/territorial/reports/${encodeURIComponent(reportId)}`, { public: true }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el reporte.')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => { void load() }, [load])

  async function openMap() {
    if (!report) return
    const coordinates = `${report.lat},${report.lng}`
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
        <Text style={styles.topTitle}>Reporte territorial</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <Text style={styles.muted}>Cargando reporte…</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.secondaryButton} onPress={() => void load()}>
              <Text style={styles.secondaryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {report ? (
          <>
            <View style={styles.hero}>
              <View style={styles.metaRow}>
                <Text style={styles.category}>{report.category.replace(/_/g, ' ')}</Text>
                <Text style={styles.status}>{report.status.replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.title}>{report.title}</Text>
              <Text style={styles.description}>{report.description}</Text>
            </View>

            <View style={styles.locationCard}>
              <Text style={styles.sectionTitle}>Ubicación</Text>
              <Text style={styles.body}>{report.neighborhood ?? 'Barrio no especificado'}</Text>
              {report.address_reference ? <Text style={styles.muted}>{report.address_reference}</Text> : null}
              <Text style={styles.coordinates}>{report.lat.toFixed(6)}, {report.lng.toFixed(6)}</Text>
              <Pressable style={styles.primaryButton} onPress={() => void openMap()}>
                <Text style={styles.primaryText}>Abrir ubicación en mapa</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Evidencia</Text>
              {report.media_urls.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                  {report.media_urls.map((url) => (
                    <Image key={url} source={{ uri: url }} style={styles.mediaImage} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.muted}>Este reporte todavía no tiene evidencia fotográfica publicada.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trazabilidad</Text>
              <Text style={styles.body}>Creado: {new Date(report.created_at).toLocaleString()}</Text>
              <Text style={styles.body}>Actualizado: {new Date(report.updated_at).toLocaleString()}</Text>
              {report.resolved_at ? <Text style={styles.body}>Resuelto: {new Date(report.resolved_at).toLocaleString()}</Text> : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  topBar: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2DED2' },
  backButton: { minWidth: 64, paddingVertical: 8 },
  backButtonPlaceholder: { width: 64 },
  backText: { color: '#1C3D2E', fontWeight: '700' },
  topTitle: { fontWeight: '700', color: '#1A1D18' },
  content: { padding: 18, paddingBottom: 40, gap: 18 },
  hero: { gap: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  category: { textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.2, color: '#667067', fontWeight: '700' },
  status: { textTransform: 'uppercase', fontSize: 11, color: '#1C3D2E', fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#11130F' },
  description: { fontSize: 16, lineHeight: 24, color: '#343931' },
  locationCard: { backgroundColor: '#E7E4D8', borderRadius: 18, padding: 16, gap: 7 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#171A15' },
  body: { color: '#343931', lineHeight: 20 },
  muted: { color: '#6D7168', lineHeight: 19 },
  coordinates: { color: '#1C3D2E', fontFamily: 'monospace', fontSize: 12 },
  primaryButton: { marginTop: 5, backgroundColor: '#17382A', borderRadius: 12, padding: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#AEB7AF', borderRadius: 12, padding: 11, alignItems: 'center' },
  secondaryText: { color: '#1C3D2E', fontWeight: '700' },
  mediaRow: { gap: 10 },
  mediaImage: { width: 240, height: 180, borderRadius: 14, backgroundColor: '#DDD' },
  errorCard: { backgroundColor: '#FBE9E7', borderRadius: 14, padding: 14, gap: 10 },
  error: { color: '#8A302A' },
})

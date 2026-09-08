import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
import type { ApiList, ReportCategory, TerritorialReportSummary } from '../../types/api'

const categories: ReportCategory[] = [
  'infraestructura',
  'servicios_publicos',
  'seguridad',
  'medio_ambiente',
  'transporte',
  'salud',
  'educacion',
  'cultura',
  'otro',
]

const initialForm = {
  title: '',
  description: '',
  category: 'infraestructura' as ReportCategory,
  neighborhood: '',
  lat: '10.3910',
  lng: '-75.4794',
  address_reference: '',
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<TerritorialReportSummary[]>([])
  const [form, setForm] = useState(initialForm)
  const [showCreate, setShowCreate] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<TerritorialReportSummary>>('/territorial/reports?limit=30', { public: true })
      setReports(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar los reportes.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function createReport() {
    const lat = Number(form.lat)
    const lng = Number(form.lng)
    if (form.title.trim().length < 10 || form.description.trim().length < 20 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Información incompleta', 'Completa título, descripción y coordenadas válidas.')
      return
    }

    setSaving(true)
    try {
      await apiMutation<TerritorialReportSummary>('/territorial/reports', 'mobile-territorial-report', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          lat,
          lng,
          neighborhood: form.neighborhood.trim() || undefined,
          address_reference: form.address_reference.trim() || undefined,
          media_urls: [],
          media_asset_ids: [],
        }),
      })
      setForm(initialForm)
      setShowCreate(false)
      await load()
    } catch (cause) {
      Alert.alert('No se pudo crear el reporte', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TERRITORIO</Text>
            <Text style={styles.title}>Reportes ciudadanos</Text>
            <Text style={styles.subtitle}>Incidencias georreferenciadas con estado y seguimiento público.</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setShowCreate((value) => !value)}>
            <Text style={styles.primaryButtonText}>{showCreate ? 'Cerrar' : 'Reportar'}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showCreate ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Nuevo reporte territorial</Text>
            <TextInput style={styles.input} placeholder="Título" value={form.title} onChangeText={(title) => setForm((prev) => ({ ...prev, title }))} />
            <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Describe la situación" value={form.description} onChangeText={(description) => setForm((prev) => ({ ...prev, description }))} />
            <Text style={styles.label}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map((category) => (
                <Pressable key={category} onPress={() => setForm((prev) => ({ ...prev, category }))} style={[styles.chip, form.category === category && styles.chipActive]}>
                  <Text style={[styles.chipText, form.category === category && styles.chipTextActive]}>{category.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={styles.input} placeholder="Barrio" value={form.neighborhood} onChangeText={(neighborhood) => setForm((prev) => ({ ...prev, neighborhood }))} />
            <View style={styles.coordinates}>
              <TextInput keyboardType="decimal-pad" style={[styles.input, styles.coordinateInput]} placeholder="Latitud" value={form.lat} onChangeText={(lat) => setForm((prev) => ({ ...prev, lat }))} />
              <TextInput keyboardType="decimal-pad" style={[styles.input, styles.coordinateInput]} placeholder="Longitud" value={form.lng} onChangeText={(lng) => setForm((prev) => ({ ...prev, lng }))} />
            </View>
            <TextInput style={styles.input} placeholder="Referencia de dirección" value={form.address_reference} onChangeText={(address_reference) => setForm((prev) => ({ ...prev, address_reference }))} />
            <Text style={styles.hint}>Phase 2A permite coordenadas manuales. Geolocalización automática, mapa y cámara entran en Phase 2B.</Text>
            <Pressable disabled={saving} style={styles.submitButton} onPress={() => void createReport()}>
              <Text style={styles.submitButtonText}>{saving ? 'Enviando…' : 'Crear reporte'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {reports.map((report) => (
            <View key={report.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.category}>{report.category.replace(/_/g, ' ')}</Text>
                <Text style={styles.status}>{report.status.replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.cardTitle}>{report.title}</Text>
              {report.description ? <Text style={styles.body}>{report.description}</Text> : null}
              <Text style={styles.muted}>{report.neighborhood ?? 'Cartagena'} · {report.lat.toFixed(4)}, {report.lng.toFixed(4)}</Text>
            </View>
          ))}
          {!error && reports.length === 0 ? <Text style={styles.empty}>No hay reportes públicos para mostrar.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 36, gap: 18 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: '#697068' },
  title: { fontSize: 28, fontWeight: '700', color: '#11130F' },
  subtitle: { color: '#6D7168', lineHeight: 20 },
  primaryButton: { backgroundColor: '#17382A', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  formCard: { backgroundColor: '#E7E4D8', borderRadius: 20, padding: 16, gap: 10 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7D3C7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#171A15' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  label: { color: '#565D54', fontWeight: '700', fontSize: 12 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: '#AEB7AF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: '#1C3D2E', borderColor: '#1C3D2E' },
  chipText: { color: '#4D554D', fontSize: 12, textTransform: 'capitalize' },
  chipTextActive: { color: '#FFFFFF' },
  coordinates: { flexDirection: 'row', gap: 8 },
  coordinateInput: { flex: 1 },
  hint: { color: '#6D7168', fontSize: 12, lineHeight: 17 },
  submitButton: { backgroundColor: '#1C3D2E', borderRadius: 12, padding: 13, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },
  list: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  category: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '700' },
  status: { textTransform: 'uppercase', fontSize: 10, color: '#1C3D2E', fontWeight: '800' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#171A15' },
  body: { color: '#343931', lineHeight: 20 },
  muted: { color: '#70746C', fontSize: 12 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
})

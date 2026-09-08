import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
import {
  getCurrentReportCoordinates,
  selectReportEvidence,
  uploadAndConfirmReportEvidence,
  type DeviceCoordinates,
  type SelectedReportEvidence,
} from '../../lib/report-device'
import type { ApiList, NearbyTerritorialReport, ReportCategory, ReportMediaState, TerritorialReportSummary } from '../../types/api'

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
  lat: '',
  lng: '',
  address_reference: '',
}

function distanceLabel(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`
  return `${(distanceMeters / 1000).toFixed(1)} km`
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<TerritorialReportSummary[]>([])
  const [nearbyReports, setNearbyReports] = useState<NearbyTerritorialReport[]>([])
  const [currentCoordinates, setCurrentCoordinates] = useState<DeviceCoordinates | null>(null)
  const [form, setForm] = useState(initialForm)
  const [selectedEvidence, setSelectedEvidence] = useState<SelectedReportEvidence | null>(null)
  const [confirmedEvidence, setConfirmedEvidence] = useState<ReportMediaState | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [selectingEvidence, setSelectingEvidence] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNearby = useCallback(async (coordinates: DeviceCoordinates) => {
    const query = new URLSearchParams({
      lat: String(coordinates.lat),
      lng: String(coordinates.lng),
      radius_km: '3',
      limit: '20',
    })
    const response = await apiFetch<ApiList<NearbyTerritorialReport>>(`/territorial/reports/nearby?${query.toString()}`, { public: true })
    setNearbyReports(response.data)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<TerritorialReportSummary>>('/territorial/reports?limit=30', { public: true })
      setReports(response.data)
      if (currentCoordinates) await loadNearby(currentCoordinates)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar los reportes.')
    }
  }, [currentCoordinates, loadNearby])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function useCurrentLocation() {
    setLocating(true)
    try {
      const coordinates = await getCurrentReportCoordinates()
      setCurrentCoordinates(coordinates)
      setForm((prev) => ({
        ...prev,
        lat: coordinates.lat.toFixed(6),
        lng: coordinates.lng.toFixed(6),
      }))
      await loadNearby(coordinates)
    } catch (cause) {
      Alert.alert('Ubicación no disponible', cause instanceof Error ? cause.message : 'No fue posible obtener tu ubicación.')
    } finally {
      setLocating(false)
    }
  }

  async function chooseEvidence(source: 'camera' | 'library') {
    setSelectingEvidence(true)
    try {
      const evidence = await selectReportEvidence(source)
      if (evidence) {
        setSelectedEvidence(evidence)
        setConfirmedEvidence(null)
      }
    } catch (cause) {
      Alert.alert('Evidencia no disponible', cause instanceof Error ? cause.message : 'No fue posible abrir el dispositivo.')
    } finally {
      setSelectingEvidence(false)
    }
  }

  function clearEvidence() {
    setSelectedEvidence(null)
    setConfirmedEvidence(null)
  }

  async function createReport() {
    const latText = form.lat.trim()
    const lngText = form.lng.trim()
    const lat = Number(latText)
    const lng = Number(lngText)
    const coordinatesValid = Boolean(latText && lngText)
      && Number.isFinite(lat)
      && Number.isFinite(lng)
      && lat >= -90
      && lat <= 90
      && lng >= -180
      && lng <= 180

    if (form.title.trim().length < 10 || form.description.trim().length < 20 || !coordinatesValid) {
      Alert.alert('Información incompleta', 'Completa título, descripción y una ubicación válida.')
      return
    }

    setSaving(true)
    try {
      let evidenceForSubmission = confirmedEvidence
      if (selectedEvidence && !evidenceForSubmission) {
        evidenceForSubmission = await uploadAndConfirmReportEvidence(selectedEvidence)
        setConfirmedEvidence(evidenceForSubmission)
      }

      const mediaAssetIds = evidenceForSubmission ? [evidenceForSubmission.media_asset_id] : []
      const created = await apiMutation<TerritorialReportSummary>('/territorial/reports', 'mobile-territorial-report', {
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
          media_asset_ids: mediaAssetIds,
        }),
      })

      setForm(initialForm)
      clearEvidence()
      setShowCreate(false)
      await load()
      router.push({ pathname: '/report/[id]', params: { id: created.id } })
    } catch (cause) {
      Alert.alert('No se pudo crear el reporte', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  function openReport(reportId: string) {
    router.push({ pathname: '/report/[id]', params: { id: reportId } })
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
            <Text style={styles.subtitle}>GPS, proximidad y evidencia fotográfica conectados al registro territorial canónico.</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setShowCreate((value) => !value)}>
            <Text style={styles.primaryButtonText}>{showCreate ? 'Cerrar' : 'Reportar'}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.locationCard}>
          <View style={styles.locationCopy}>
            <Text style={styles.cardTitle}>Tu entorno</Text>
            <Text style={styles.hint}>
              {currentCoordinates
                ? `Ubicación activa${currentCoordinates.accuracy ? ` · precisión ±${Math.round(currentCoordinates.accuracy)} m` : ''}`
                : 'Activa tu ubicación para ver incidencias públicas a 3 km.'}
            </Text>
          </View>
          <Pressable disabled={locating} style={styles.locationButton} onPress={() => void useCurrentLocation()}>
            <Text style={styles.locationButtonText}>{locating ? 'Ubicando…' : currentCoordinates ? 'Actualizar GPS' : 'Usar GPS'}</Text>
          </Pressable>
        </View>

        {currentCoordinates ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cerca de ti · 3 km</Text>
            <View style={styles.list}>
              {nearbyReports.map((report) => (
                <Pressable key={report.id} style={styles.nearbyCard} onPress={() => openReport(report.id)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.category}>{report.category.replace(/_/g, ' ')}</Text>
                    <Text style={styles.distance}>{distanceLabel(report.distance_meters)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{report.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>{report.description}</Text>
                  <Text style={styles.muted}>{report.neighborhood ?? 'Sin barrio'} · {report.status.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
              {nearbyReports.length === 0 ? <Text style={styles.empty}>No hay reportes públicos dentro de 3 km.</Text> : null}
            </View>
          </View>
        ) : null}

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

            <Pressable disabled={locating} style={styles.deviceAction} onPress={() => void useCurrentLocation()}>
              <Text style={styles.deviceActionText}>{locating ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}</Text>
            </Pressable>

            <View style={styles.coordinates}>
              <TextInput autoCapitalize="none" style={[styles.input, styles.coordinateInput]} placeholder="Latitud" value={form.lat} onChangeText={(lat) => setForm((prev) => ({ ...prev, lat }))} />
              <TextInput autoCapitalize="none" style={[styles.input, styles.coordinateInput]} placeholder="Longitud" value={form.lng} onChangeText={(lng) => setForm((prev) => ({ ...prev, lng }))} />
            </View>
            <TextInput style={styles.input} placeholder="Referencia de dirección" value={form.address_reference} onChangeText={(address_reference) => setForm((prev) => ({ ...prev, address_reference }))} />

            <Text style={styles.label}>Evidencia fotográfica opcional</Text>
            <View style={styles.evidenceActions}>
              <Pressable disabled={selectingEvidence} style={styles.deviceAction} onPress={() => void chooseEvidence('camera')}>
                <Text style={styles.deviceActionText}>Tomar foto</Text>
              </Pressable>
              <Pressable disabled={selectingEvidence} style={styles.deviceAction} onPress={() => void chooseEvidence('library')}>
                <Text style={styles.deviceActionText}>Elegir foto</Text>
              </Pressable>
            </View>

            {selectedEvidence ? (
              <View style={styles.previewCard}>
                <Image source={{ uri: selectedEvidence.uri }} style={styles.previewImage} />
                <View style={styles.previewCopy}>
                  <Text style={styles.previewTitle}>{confirmedEvidence ? 'Evidencia confirmada' : 'Evidencia lista'}</Text>
                  <Text style={styles.hint}>{selectedEvidence.width} × {selectedEvidence.height}</Text>
                  {confirmedEvidence ? <Text style={styles.confirmedEvidence}>Asset seguro listo para reintento</Text> : null}
                  <Pressable onPress={clearEvidence}>
                    <Text style={styles.removeEvidence}>Quitar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.hint}>La foto se carga directamente al proveedor seguro y el API confirma propiedad/metadata. Si la creación del reporte queda incierta, el mismo asset confirmado se reutiliza para conservar el payload idempotente.</Text>
            <Pressable disabled={saving} style={styles.submitButton} onPress={() => void createReport()}>
              <Text style={styles.submitButtonText}>{saving ? 'Procesando reporte…' : 'Crear reporte'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reportes recientes</Text>
          <View style={styles.list}>
            {reports.map((report) => (
              <Pressable key={report.id} style={styles.card} onPress={() => openReport(report.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.category}>{report.category.replace(/_/g, ' ')}</Text>
                  <Text style={styles.status}>{report.status.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.cardTitle}>{report.title}</Text>
                {report.description ? <Text style={styles.body} numberOfLines={3}>{report.description}</Text> : null}
                <Text style={styles.muted}>{report.neighborhood ?? 'Cartagena'} · {report.lat.toFixed(4)}, {report.lng.toFixed(4)}</Text>
              </Pressable>
            ))}
            {!error && reports.length === 0 ? <Text style={styles.empty}>No hay reportes públicos para mostrar.</Text> : null}
          </View>
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
  locationCard: { backgroundColor: '#17382A', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationCopy: { flex: 1, gap: 4 },
  locationButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  locationButtonText: { color: '#17382A', fontWeight: '700', fontSize: 12 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#171A15' },
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
  deviceAction: { flex: 1, borderWidth: 1, borderColor: '#AEB7AF', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 11, alignItems: 'center' },
  deviceActionText: { color: '#1C3D2E', fontWeight: '700', fontSize: 12 },
  evidenceActions: { flexDirection: 'row', gap: 8 },
  previewCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, flexDirection: 'row', gap: 12, alignItems: 'center' },
  previewImage: { width: 74, height: 74, borderRadius: 10, backgroundColor: '#DDD' },
  previewCopy: { flex: 1, gap: 4 },
  previewTitle: { fontWeight: '700', color: '#1A1D18' },
  confirmedEvidence: { color: '#1C3D2E', fontSize: 11, fontWeight: '700' },
  removeEvidence: { color: '#8A302A', fontWeight: '700', fontSize: 12 },
  hint: { color: '#6D7168', fontSize: 12, lineHeight: 17 },
  submitButton: { backgroundColor: '#1C3D2E', borderRadius: 12, padding: 13, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },
  list: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 9 },
  nearbyCard: { backgroundColor: '#EEF3EF', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#D5E0D7' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  category: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '700' },
  status: { textTransform: 'uppercase', fontSize: 10, color: '#1C3D2E', fontWeight: '800' },
  distance: { fontSize: 11, color: '#1C3D2E', fontWeight: '800' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#171A15' },
  body: { color: '#343931', lineHeight: 20 },
  muted: { color: '#70746C', fontSize: 12 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 22 },
})

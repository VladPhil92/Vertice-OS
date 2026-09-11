import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TerritorialMap } from '../../components/TerritorialMap'
import { TerritoryTargetPicker } from '../../components/TerritoryTargetPicker'
import { VerticeBrand } from '../../components/VerticeBrand'
import { apiFetch, apiMutation } from '../../lib/api'
import {
  getCurrentReportCoordinates,
  selectReportEvidence,
  uploadAndConfirmReportEvidence,
  type DeviceCoordinates,
  type SelectedReportEvidence,
} from '../../lib/report-device'
import {
  setActiveTerritory,
  suggestTerritoryFromCoordinates,
  type TerritoryOption,
} from '../../lib/territory-context'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
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
  const [targetTerritory, setTargetTerritory] = useState<TerritoryOption | null>(null)
  const [targetSource, setTargetSource] = useState<'manual' | 'gps'>('manual')
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

      try {
        const suggestion = await suggestTerritoryFromCoordinates(coordinates.lat, coordinates.lng)
        if (suggestion.status === 'matched') {
          setTargetTerritory(suggestion.territory)
          setTargetSource('gps')
          await setActiveTerritory(suggestion.territory.code, 'gps').catch(() => null)
        } else if (suggestion.status === 'outside_colombia') {
          setTargetTerritory(null)
          setTargetSource('manual')
          Alert.alert(
            'Estás fuera de Colombia',
            'Tu territorio de origen no cambia. Para aportar en VÉRTICE selecciona manualmente el municipio colombiano al que pertenece la contribución y usa las coordenadas del hecho, no tu ubicación actual.',
          )
        } else {
          setTargetTerritory(null)
          setTargetSource('manual')
          Alert.alert('Municipio no identificado', 'El GPS obtuvo coordenadas, pero debes confirmar manualmente el municipio colombiano del reporte.')
        }
      } catch {
        setTargetTerritory(null)
        setTargetSource('manual')
      }
    } catch (cause) {
      Alert.alert(
        'Ubicación no disponible',
        `${cause instanceof Error ? cause.message : 'No fue posible obtener tu ubicación.'}\n\nPuedes continuar seleccionando el municipio y escribiendo las coordenadas manualmente.`,
      )
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
    if (!targetTerritory) {
      Alert.alert('Territorio requerido', 'Selecciona el municipio o distrito colombiano donde ocurre el reporte.')
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
          territory_code: targetTerritory.code,
          territory_source: targetSource,
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
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        )}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <VerticeBrand variant="symbol" width={40} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TERRITORIO · COLOMBIA</Text>
            <Text style={styles.title}>Reportes ciudadanos</Text>
            <Text style={styles.subtitle}>Tu ciudad de registro es tu origen cívico, no una frontera. Reporta en cualquier territorio colombiano con GPS o selección manual.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => setShowCreate((value) => !value)}
          >
            <Text style={styles.primaryButtonText}>{showCreate ? 'Cerrar' : 'Reportar'}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.locationCard}>
          <View style={styles.locationCopy}>
            <Text style={[styles.cardTitle, styles.locationTitle]}>Tu entorno actual</Text>
            <Text style={styles.locationHint}>
              {currentCoordinates
                ? `Ubicación activa${currentCoordinates.accuracy ? ` · precisión ±${Math.round(currentCoordinates.accuracy)} m` : ''}${targetTerritory ? ` · ${targetTerritory.name}` : ''}`
                : 'Activa tu ubicación para ver incidencias públicas a 3 km. El GPS no cambia tu ciudad de origen.'}
            </Text>
          </View>
          <Pressable
            disabled={locating}
            style={({ pressed }) => [styles.locationButton, pressed && styles.pressed, locating && styles.disabled]}
            onPress={() => void useCurrentLocation()}
          >
            <Text style={styles.locationButtonText}>{locating ? 'Ubicando…' : currentCoordinates ? 'Actualizar GPS' : 'Usar GPS'}</Text>
          </Pressable>
        </View>

        {currentCoordinates ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapa de incidencias · 3 km</Text>
            <TerritorialMap center={currentCoordinates} reports={nearbyReports} onOpenReport={openReport} />
            <Text style={styles.sectionTitle}>Cerca de ti</Text>
            <View style={styles.list}>
              {nearbyReports.map((report) => (
                <Pressable key={report.id} style={({ pressed }) => [styles.nearbyCard, pressed && styles.pressed]} onPress={() => openReport(report.id)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.category}>{report.category.replace(/_/g, ' ')}</Text>
                    <Text style={styles.distance}>{distanceLabel(report.distance_meters)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{report.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>{report.description}</Text>
                  <Text style={styles.muted}>{report.neighborhood ?? 'Sector no especificado'} · {report.status.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
              {nearbyReports.length === 0 ? <Text style={styles.empty}>No hay reportes públicos dentro de 3 km.</Text> : null}
            </View>
          </View>
        ) : null}

        {showCreate ? (
          <View style={styles.formCard}>
            <View style={styles.formAccent} />
            <Text style={styles.formKicker}>NUEVA EVIDENCIA TERRITORIAL</Text>
            <Text style={styles.cardTitle}>Nuevo reporte territorial</Text>
            <TerritoryTargetPicker
              value={targetTerritory}
              onChange={(territory, source) => {
                setTargetTerritory(territory)
                setTargetSource(source)
              }}
              label="Municipio o distrito del reporte"
            />
            <TextInput
              style={styles.input}
              placeholder="Título"
              placeholderTextColor={colors.placeholder}
              value={form.title}
              onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              placeholder="Describe la situación"
              placeholderTextColor={colors.placeholder}
              value={form.description}
              onChangeText={(description) => setForm((prev) => ({ ...prev, description }))}
            />
            <Text style={styles.label}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map((category) => (
                <Pressable key={category} onPress={() => setForm((prev) => ({ ...prev, category }))} style={[styles.chip, form.category === category && styles.chipActive]}>
                  <Text style={[styles.chipText, form.category === category && styles.chipTextActive]}>{category.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="Barrio o sector (opcional)"
              placeholderTextColor={colors.placeholder}
              value={form.neighborhood}
              onChangeText={(neighborhood) => setForm((prev) => ({ ...prev, neighborhood }))}
            />

            <Pressable disabled={locating} style={({ pressed }) => [styles.deviceAction, pressed && styles.pressed, locating && styles.disabled]} onPress={() => void useCurrentLocation()}>
              <Text style={styles.deviceActionText}>{locating ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}</Text>
            </Pressable>

            <View style={styles.coordinates}>
              <TextInput
                autoCapitalize="none"
                style={[styles.input, styles.coordinateInput]}
                placeholder="Latitud"
                placeholderTextColor={colors.placeholder}
                value={form.lat}
                onChangeText={(lat) => { setTargetSource('manual'); setForm((prev) => ({ ...prev, lat })) }}
              />
              <TextInput
                autoCapitalize="none"
                style={[styles.input, styles.coordinateInput]}
                placeholder="Longitud"
                placeholderTextColor={colors.placeholder}
                value={form.lng}
                onChangeText={(lng) => { setTargetSource('manual'); setForm((prev) => ({ ...prev, lng })) }}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Referencia de dirección"
              placeholderTextColor={colors.placeholder}
              value={form.address_reference}
              onChangeText={(address_reference) => setForm((prev) => ({ ...prev, address_reference }))}
            />
            <Text style={styles.hint}>Si niegas el permiso de ubicación, VÉRTICE sigue funcionando: selecciona el municipio y escribe la ubicación del hecho manualmente.</Text>

            <Text style={styles.label}>Evidencia fotográfica opcional</Text>
            <View style={styles.evidenceActions}>
              <Pressable disabled={selectingEvidence} style={({ pressed }) => [styles.deviceAction, pressed && styles.pressed, selectingEvidence && styles.disabled]} onPress={() => void chooseEvidence('camera')}>
                <Text style={styles.deviceActionText}>Tomar foto</Text>
              </Pressable>
              <Pressable disabled={selectingEvidence} style={({ pressed }) => [styles.deviceAction, pressed && styles.pressed, selectingEvidence && styles.disabled]} onPress={() => void chooseEvidence('library')}>
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
            <Pressable disabled={saving} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.disabled]} onPress={() => void createReport()}>
              <Text style={styles.submitButtonText}>{saving ? 'Procesando reporte…' : 'Crear reporte'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reportes recientes · Colombia</Text>
          <View style={styles.list}>
            {reports.map((report) => (
              <Pressable key={report.id} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => openReport(report.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.category}>{report.category.replace(/_/g, ' ')}</Text>
                  <Text style={styles.status}>{report.status.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.cardTitle}>{report.title}</Text>
                {report.description ? <Text style={styles.body} numberOfLines={3}>{report.description}</Text> : null}
                <Text style={styles.muted}>{report.neighborhood ?? 'Territorio colombiano'} · {report.lat.toFixed(4)}, {report.lng.toFixed(4)}</Text>
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.lg },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  headerBrand: { borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs },
  headerCopy: { flex: 1, gap: spacing.xxs },
  eyebrow: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.title },
  subtitle: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  primaryButton: { minHeight: interaction.minimumTouchTarget, backgroundColor: colors.navy, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center' },
  primaryButtonText: { color: colors.white, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  locationCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...elevation.card },
  locationCopy: { flex: 1, gap: spacing.xxs },
  locationTitle: { color: colors.white },
  locationHint: { color: colors.borderActive, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 17 },
  locationButton: { minHeight: interaction.minimumTouchTarget, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, borderRadius: radius.md, justifyContent: 'center' },
  locationButtonText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 19, fontWeight: '800' },
  formCard: { overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  formAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.citizen },
  formKicker: { marginTop: spacing.xxs, color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  input: { minHeight: interaction.inputHeight, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.textPrimary, fontFamily: typography.bodyFamily },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  label: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  chips: { gap: spacing.xs, paddingVertical: spacing.xxs },
  chip: { borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12, textTransform: 'capitalize' },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  coordinates: { flexDirection: 'row', gap: spacing.xs },
  coordinateInput: { flex: 1 },
  deviceAction: { flex: 1, minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  deviceActionText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  evidenceActions: { flexDirection: 'row', gap: spacing.xs },
  previewCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  previewImage: { width: 74, height: 74, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  previewCopy: { flex: 1, gap: spacing.xxs },
  previewTitle: { color: colors.textPrimary, fontFamily: typography.bodyExtraBoldFamily, fontWeight: '800' },
  confirmedEvidence: { color: colors.successText, fontFamily: typography.bodyBoldFamily, fontSize: 11, fontWeight: '700' },
  removeEvidence: { color: colors.errorText, fontFamily: typography.bodyBoldFamily, fontWeight: '700', fontSize: 12 },
  hint: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 17 },
  submitButton: { minHeight: interaction.buttonHeight, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  list: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, ...elevation.card },
  nearbyCard: { backgroundColor: colors.infoBackground, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.infoBorder },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  category: { textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  status: { textTransform: 'uppercase', color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, fontWeight: '800' },
  distance: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 17, fontWeight: '800' },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 20 },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12 },
  error: { color: colors.errorText, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, padding: spacing.sm, fontFamily: typography.bodyFamily },
  empty: { textAlign: 'center', color: colors.textTertiary, fontFamily: typography.bodyFamily, paddingVertical: spacing.xl },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

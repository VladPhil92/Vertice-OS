import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TerritoryTargetPicker } from '../../components/TerritoryTargetPicker'
import { apiFetch, apiMutation } from '../../lib/api'
import type { TerritoryOption } from '../../lib/territory-context'
import type { ApiList, CivicActionSummary, CivicEvidence } from '../../types/api'

const initialForm = {
  title: '',
  problem: '',
  objective: '',
  category: 'Infraestructura',
  neighborhood: '',
}

export default function ActionsScreen() {
  const [actions, setActions] = useState<CivicActionSummary[]>([])
  const [form, setForm] = useState(initialForm)
  const [targetTerritory, setTargetTerritory] = useState<TerritoryOption | null>(null)
  const [targetSource, setTargetSource] = useState<'manual' | 'gps'>('manual')
  const [showCreate, setShowCreate] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evidenceActionId, setEvidenceActionId] = useState<string | null>(null)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceDescription, setEvidenceDescription] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<CivicActionSummary>>('/civic-actions/mine?limit=40')
      setActions(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tus acciones.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function createAction() {
    if (form.title.trim().length < 8 || form.problem.trim().length < 20 || form.objective.trim().length < 10) {
      Alert.alert('Información incompleta', 'Completa título, problema y objetivo con suficiente detalle.')
      return
    }
    if (!targetTerritory) {
      Alert.alert('Territorio requerido', 'Selecciona el municipio o distrito colombiano al que pertenece esta acción.')
      return
    }

    setSaving(true)
    try {
      await apiMutation<CivicActionSummary>('/civic-actions', 'mobile-civic-action', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          problem: form.problem.trim(),
          objective: form.objective.trim(),
          category: form.category.trim(),
          neighborhood: form.neighborhood.trim() || null,
          territory_code: targetTerritory.code,
          territory_source: targetSource,
        }),
      })
      setForm(initialForm)
      setShowCreate(false)
      await load()
    } catch (cause) {
      Alert.alert('No se pudo registrar', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  async function addEvidence() {
    if (!evidenceActionId || !/^https?:\/\//i.test(evidenceUrl.trim())) {
      Alert.alert('URL inválida', 'Ingresa una URL pública de evidencia.')
      return
    }

    setSaving(true)
    try {
      await apiMutation<CivicEvidence>(`/civic-actions/${evidenceActionId}/evidence`, 'mobile-civic-evidence', {
        method: 'POST',
        body: JSON.stringify({
          evidence_type: 'photo',
          evidence_url: evidenceUrl.trim(),
          description: evidenceDescription.trim() || null,
        }),
      })
      setEvidenceActionId(null)
      setEvidenceUrl('')
      setEvidenceDescription('')
      await load()
    } catch (cause) {
      Alert.alert('No se pudo adjuntar la evidencia', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
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
            <Text style={styles.eyebrow}>GESTIÓN SOCIAL · COLOMBIA</Text>
            <Text style={styles.title}>Acciones cívicas</Text>
            <Text style={styles.subtitle}>Tu ciudadanía Vértice es nacional: puedes aportar donde estés, sin cambiar tu ciudad de origen.</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setShowCreate((value) => !value)}>
            <Text style={styles.primaryButtonText}>{showCreate ? 'Cerrar' : 'Nueva'}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showCreate ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Registrar acción</Text>
            <TerritoryTargetPicker
              value={targetTerritory}
              onChange={(territory, source) => {
                setTargetTerritory(territory)
                setTargetSource(source)
              }}
            />
            <TextInput style={styles.input} placeholder="Título" value={form.title} onChangeText={(title) => setForm((prev) => ({ ...prev, title }))} />
            <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Problema que quieres resolver" value={form.problem} onChangeText={(problem) => setForm((prev) => ({ ...prev, problem }))} />
            <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Objetivo verificable" value={form.objective} onChangeText={(objective) => setForm((prev) => ({ ...prev, objective }))} />
            <TextInput style={styles.input} placeholder="Categoría" value={form.category} onChangeText={(category) => setForm((prev) => ({ ...prev, category }))} />
            <TextInput style={styles.input} placeholder="Barrio o sector (opcional)" value={form.neighborhood} onChangeText={(neighborhood) => setForm((prev) => ({ ...prev, neighborhood }))} />
            <Text style={styles.mobilityNote}>El territorio seleccionado pertenece a la acción. No modifica tu territorio de origen ni concede autoridad de gobernanza local.</Text>
            <Pressable disabled={saving} style={styles.submitButton} onPress={() => void createAction()}>
              <Text style={styles.submitButtonText}>{saving ? 'Guardando…' : 'Registrar acción'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {actions.map((action) => (
            <View key={action.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.status}>{action.status.replace(/_/g, ' ')}</Text>
                <Text style={styles.score}>{action.civic_score ?? 0}</Text>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.muted}>{action.category}{action.neighborhood ? ` · ${action.neighborhood}` : ''}</Text>
              <Text style={styles.body}>{action.objective}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Evidencias: {action.evidence_count ?? 0}</Text>
                <Text style={styles.meta}>Confianza: {action.confidence_score ?? 0}</Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => setEvidenceActionId(evidenceActionId === action.id ? null : action.id)}>
                <Text style={styles.secondaryButtonText}>{evidenceActionId === action.id ? 'Cancelar evidencia' : 'Añadir evidencia'}</Text>
              </Pressable>
              {evidenceActionId === action.id ? (
                <View style={styles.evidenceForm}>
                  <TextInput autoCapitalize="none" style={styles.input} placeholder="https://..." value={evidenceUrl} onChangeText={setEvidenceUrl} />
                  <TextInput style={styles.input} placeholder="Descripción breve" value={evidenceDescription} onChangeText={setEvidenceDescription} />
                  <Pressable disabled={saving} style={styles.submitButton} onPress={() => void addEvidence()}>
                    <Text style={styles.submitButtonText}>{saving ? 'Adjuntando…' : 'Guardar evidencia'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {!error && actions.length === 0 ? <Text style={styles.empty}>Aún no tienes acciones registradas.</Text> : null}
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
  mobilityNote: { color: '#596057', fontSize: 11, lineHeight: 16 },
  submitButton: { backgroundColor: '#1C3D2E', borderRadius: 12, padding: 13, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },
  list: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '700' },
  score: { fontSize: 24, color: '#1C3D2E', fontWeight: '800' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#171A15' },
  muted: { color: '#70746C' },
  body: { color: '#343931', lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 14 },
  meta: { color: '#596057', fontSize: 12 },
  secondaryButton: { borderWidth: 1, borderColor: '#BFC7C0', borderRadius: 12, padding: 11, alignItems: 'center' },
  secondaryButtonText: { color: '#1C3D2E', fontWeight: '700' },
  evidenceForm: { gap: 8, paddingTop: 4 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
})

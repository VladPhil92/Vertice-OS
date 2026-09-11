import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TerritoryTargetPicker } from '../../components/TerritoryTargetPicker'
import { VerticeBrand } from '../../components/VerticeBrand'
import { apiFetch, apiMutation } from '../../lib/api'
import type { TerritoryOption } from '../../lib/territory-context'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
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
            <Text style={styles.eyebrow}>GESTIÓN SOCIAL · COLOMBIA</Text>
            <Text style={styles.title}>Acciones cívicas</Text>
            <Text style={styles.subtitle}>Tu ciudadanía VÉRTICE es nacional: puedes aportar donde estés, sin cambiar tu ciudad de origen.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => setShowCreate((value) => !value)}
          >
            <Text style={styles.primaryButtonText}>{showCreate ? 'Cerrar' : 'Nueva'}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showCreate ? (
          <View style={styles.formCard}>
            <View style={styles.formAccent} />
            <Text style={styles.formKicker}>ACCIÓN CÍVICA</Text>
            <Text style={styles.cardTitle}>Registrar acción</Text>
            <TerritoryTargetPicker
              value={targetTerritory}
              onChange={(territory, source) => {
                setTargetTerritory(territory)
                setTargetSource(source)
              }}
            />
            <TextInput style={styles.input} placeholder="Título" placeholderTextColor={colors.placeholder} value={form.title} onChangeText={(title) => setForm((prev) => ({ ...prev, title }))} />
            <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Problema que quieres resolver" placeholderTextColor={colors.placeholder} value={form.problem} onChangeText={(problem) => setForm((prev) => ({ ...prev, problem }))} />
            <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Objetivo verificable" placeholderTextColor={colors.placeholder} value={form.objective} onChangeText={(objective) => setForm((prev) => ({ ...prev, objective }))} />
            <TextInput style={styles.input} placeholder="Categoría" placeholderTextColor={colors.placeholder} value={form.category} onChangeText={(category) => setForm((prev) => ({ ...prev, category }))} />
            <TextInput style={styles.input} placeholder="Barrio o sector (opcional)" placeholderTextColor={colors.placeholder} value={form.neighborhood} onChangeText={(neighborhood) => setForm((prev) => ({ ...prev, neighborhood }))} />
            <Text style={styles.mobilityNote}>El territorio seleccionado pertenece a la acción. No modifica tu territorio de origen ni concede autoridad de gobernanza local.</Text>
            <Pressable disabled={saving} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.disabled]} onPress={() => void createAction()}>
              <Text style={styles.submitButtonText}>{saving ? 'Guardando…' : 'Registrar acción'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {actions.map((action) => (
            <View key={action.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.status}>{action.status.replace(/_/g, ' ')}</Text>
                <View style={styles.scorePill}>
                  <Text style={styles.score}>{action.civic_score ?? 0}</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.muted}>{action.category}{action.neighborhood ? ` · ${action.neighborhood}` : ''}</Text>
              <Text style={styles.body}>{action.objective}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Evidencias · {action.evidence_count ?? 0}</Text>
                <Text style={styles.meta}>Confianza · {action.confidence_score ?? 0}</Text>
              </View>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => setEvidenceActionId(evidenceActionId === action.id ? null : action.id)}>
                <Text style={styles.secondaryButtonText}>{evidenceActionId === action.id ? 'Cancelar evidencia' : 'Añadir evidencia'}</Text>
              </Pressable>
              {evidenceActionId === action.id ? (
                <View style={styles.evidenceForm}>
                  <TextInput autoCapitalize="none" style={styles.input} placeholder="https://..." placeholderTextColor={colors.placeholder} value={evidenceUrl} onChangeText={setEvidenceUrl} />
                  <TextInput style={styles.input} placeholder="Descripción breve" placeholderTextColor={colors.placeholder} value={evidenceDescription} onChangeText={setEvidenceDescription} />
                  <Pressable disabled={saving} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.disabled]} onPress={() => void addEvidence()}>
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.lg },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  headerBrand: { borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs },
  headerCopy: { flex: 1, gap: spacing.xxs },
  eyebrow: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.title },
  subtitle: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  primaryButton: { minHeight: interaction.minimumTouchTarget, backgroundColor: colors.navy, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center' },
  primaryButtonText: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.caption },
  formCard: { overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  formAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.citizen },
  formKicker: { marginTop: spacing.xxs, color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  input: { minHeight: interaction.inputHeight, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.textPrimary, fontFamily: typography.bodyFamily },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  mobilityNote: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 11, lineHeight: 16 },
  submitButton: { minHeight: interaction.buttonHeight, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.button },
  list: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, ...elevation.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  scorePill: { minWidth: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, alignItems: 'center' },
  score: { color: colors.navy, fontFamily: typography.displayFamily, fontSize: 18, fontWeight: '800' },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  meta: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12 },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyFamily, ...typography.roles.caption },
  evidenceForm: { gap: spacing.xs, paddingTop: spacing.xxs },
  error: { color: colors.errorText, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, padding: spacing.sm, fontFamily: typography.bodyFamily },
  empty: { textAlign: 'center', color: colors.textTertiary, fontFamily: typography.bodyFamily, paddingVertical: spacing.xxl },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

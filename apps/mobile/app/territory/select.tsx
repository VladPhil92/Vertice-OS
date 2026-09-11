import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch, apiMutation } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { ApiList, TerritoryActivationStatus } from '../../types/api'

interface TerritoryOption {
  code: string
  external_code: string | null
  name: string
  level: 'municipality' | 'district' | string
  parent_code: string | null
  activation_status: TerritoryActivationStatus
}

const ACTIVATION_LABEL: Record<string, string> = {
  available: 'Disponible',
  emerging: 'Emergente',
  community_active: 'Comunidad activa',
  pilot_ready: 'Piloto operativo',
  verified_network: 'Red verificada',
}

function activationTone(status: TerritoryActivationStatus) {
  if (status === 'verified_network') return styles.activationVerified
  if (status === 'pilot_ready' || status === 'community_active') return styles.activationActive
  if (status === 'emerging') return styles.activationEmerging
  return styles.activationAvailable
}

export default function TerritorySelectScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TerritoryOption[]>([])
  const [searching, setSearching] = useState(false)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setError('Escribe al menos 2 caracteres del municipio, distrito o código DANE.')
      return
    }
    setSearching(true)
    setError(null)
    try {
      const response = await apiFetch<ApiList<TerritoryOption>>(
        `/territories?q=${encodeURIComponent(normalized)}&limit=60`,
        { public: true },
      )
      setResults(response.data.filter((territory) => territory.level === 'municipality' || territory.level === 'district'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el catálogo territorial.')
    } finally {
      setSearching(false)
    }
  }

  async function selectTerritory(territory: TerritoryOption) {
    setSavingCode(territory.code)
    setError(null)
    try {
      await apiMutation('/territories/me', 'primary-territory-select', {
        method: 'PUT',
        body: JSON.stringify({ territory_code: territory.code, neighborhood: null }),
      })
      router.replace('/territory/activate')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible vincular este territorio.')
    } finally {
      setSavingCode(null)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="territory" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>TERRITORIO</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <VerticeIcon name="back" color={colors.navy} size={18} />
          <Text style={styles.backText}>Volver</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <VerticeIcon name="territory" color={colors.white} size={24} />
          </View>
          <Text style={styles.eyebrow}>TERRITORIO PRINCIPAL</Text>
          <Text style={styles.title}>Vincula tu municipio o distrito</Text>
          <Text style={styles.heroBody}>
            Esta selección autodeclarada organiza tu experiencia local en VÉRTICE y no prueba residencia, identidad territorial ni elegibilidad de gobernanza.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>BUSCAR CIUDAD</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              autoCapitalize="words"
              returnKeyType="search"
              placeholder="Ej. Cartagena, Medellín o 13001"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: searching }}
              disabled={searching}
              onPress={() => void search()}
              style={({ pressed }) => [styles.searchButton, searching && styles.disabled, pressed && !searching && styles.pressed]}
            >
              <Text style={styles.searchButtonText}>{searching ? 'Buscando…' : 'Buscar'}</Text>
            </Pressable>
          </View>
          {error ? (
            <View style={styles.errorCard}>
              <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {results.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionKicker}>CATÁLOGO TERRITORIAL</Text>
            <Text style={styles.sectionTitle}>Resultados</Text>
            <View style={styles.resultList}>
              {results.map((territory) => (
                <View key={territory.code} style={styles.resultCard}>
                  <View style={styles.resultCopy}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultTitle}>{territory.name}</Text>
                      <View style={[styles.activationPill, activationTone(territory.activation_status)]}>
                        <Text style={styles.activationText}>{ACTIVATION_LABEL[territory.activation_status] ?? territory.activation_status}</Text>
                      </View>
                    </View>
                    <Text style={styles.resultMeta}>
                      {territory.level === 'district' ? 'Distrito' : 'Municipio'}
                      {territory.external_code ? ` · DANE ${territory.external_code}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: savingCode !== null }}
                    disabled={savingCode !== null}
                    onPress={() => void selectTerritory(territory)}
                    style={({ pressed }) => [styles.selectButton, savingCode !== null && styles.disabled, pressed && savingCode === null && styles.pressed]}
                  >
                    <Text style={styles.selectButtonText}>{savingCode === territory.code ? 'Vinculando…' : 'Elegir'}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : query.trim().length >= 2 && !searching && !error ? (
          <View style={styles.emptyCard}>
            <VerticeIcon name="territory" color={colors.textTertiary} size={24} />
            <Text style={styles.emptyText}>No hay resultados municipales o distritales para esta búsqueda.</Text>
          </View>
        ) : null}

        <View style={styles.boundaryCard}>
          <Text style={styles.boundaryKicker}>FRONTERA DE IDENTIDAD TERRITORIAL</Text>
          <Text style={styles.boundaryText}>
            Cambiar esta selección autodeclarada sólo cambia contexto de producto. No crea territory assurance, rol, reputación, padrón electoral, voto ni autoridad cívica.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  label: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  searchRow: { flexDirection: 'row', gap: spacing.xs },
  input: { flex: 1, minHeight: interaction.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.textPrimary, fontFamily: typography.bodyFamily, fontSize: 15 },
  searchButton: { minHeight: interaction.inputHeight, minWidth: 96, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy, paddingHorizontal: spacing.sm },
  searchButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  errorCard: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBackground, padding: spacing.sm },
  errorText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  resultList: { gap: spacing.sm },
  resultCard: { gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surface },
  resultCopy: { gap: spacing.xs },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  resultTitle: { flex: 1, color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  resultMeta: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  activationPill: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  activationVerified: { backgroundColor: colors.successBackground },
  activationActive: { backgroundColor: colors.infoBackground },
  activationEmerging: { backgroundColor: colors.warningBackground },
  activationAvailable: { backgroundColor: colors.surfaceAlt },
  activationText: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  selectButton: { minHeight: interaction.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.citizen, paddingHorizontal: spacing.md },
  selectButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  emptyCard: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  boundaryCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, gap: spacing.xs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

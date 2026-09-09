import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
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
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>TERRITORIO PRINCIPAL</Text>
          <Text style={styles.title}>Vincula tu municipio o distrito</Text>
          <Text style={styles.heroBody}>
            Esta selección organiza tu experiencia local en Vértice. Es una declaración del usuario y no prueba residencia, identidad territorial ni elegibilidad de gobernanza.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Buscar ciudad</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              autoCapitalize="words"
              returnKeyType="search"
              placeholder="Ej. Cartagena, Medellín o 13001"
              placeholderTextColor="#8A8E85"
              style={styles.input}
            />
            <Pressable accessibilityRole="button" disabled={searching} onPress={() => void search()} style={[styles.searchButton, searching && styles.disabled]}>
              <Text style={styles.searchButtonText}>{searching ? '…' : 'Buscar'}</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {results.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resultados</Text>
            <View style={styles.resultList}>
              {results.map((territory) => (
                <View key={territory.code} style={styles.resultCard}>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{territory.name}</Text>
                    <Text style={styles.resultMeta}>
                      {territory.level === 'district' ? 'Distrito' : 'Municipio'}
                      {territory.external_code ? ` · DANE ${territory.external_code}` : ''}
                      {' · '}{ACTIVATION_LABEL[territory.activation_status] ?? territory.activation_status}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingCode !== null}
                    onPress={() => void selectTerritory(territory)}
                    style={[styles.selectButton, savingCode !== null && styles.disabled]}
                  >
                    <Text style={styles.selectButtonText}>{savingCode === territory.code ? 'Vinculando…' : 'Elegir'}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : query.trim().length >= 2 && !searching && !error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No hay resultados municipales o distritales para esta búsqueda.</Text>
          </View>
        ) : null}

        <View style={styles.boundaryCard}>
          <Text style={styles.boundaryText}>
            <Text style={styles.boundaryStrong}>Frontera de identidad territorial. </Text>
            Cambiar esta selección sólo cambia contexto de producto. No crea `territory_assurance`, rol, reputación, padrón electoral, voto ni autoridad cívica.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 44, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#24573E', fontWeight: '700' },
  hero: { borderRadius: 24, padding: 22, backgroundColor: '#17382A', gap: 9 },
  eyebrow: { color: '#C8D9CF', fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  heroBody: { color: '#D9E4DD', lineHeight: 21 },
  card: { borderRadius: 22, padding: 18, backgroundColor: '#FFFFFF', gap: 12 },
  label: { color: '#31362F', fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 9 },
  input: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#D6D3CA', backgroundColor: '#FAF9F5', paddingHorizontal: 13, color: '#20251F' },
  searchButton: { minHeight: 50, minWidth: 82, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17382A', paddingHorizontal: 13 },
  searchButtonText: { color: '#FFFFFF', fontWeight: '800' },
  errorText: { color: '#8A3B34', lineHeight: 19 },
  sectionTitle: { color: '#171A15', fontSize: 20, fontWeight: '800' },
  resultList: { gap: 9 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: '#E5E2D9', padding: 14 },
  resultCopy: { flex: 1, gap: 3 },
  resultTitle: { color: '#252A24', fontWeight: '800' },
  resultMeta: { color: '#777B73', fontSize: 12, lineHeight: 17 },
  selectButton: { minHeight: 40, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E6EEE8', paddingHorizontal: 11 },
  selectButtonText: { color: '#17382A', fontWeight: '800', fontSize: 12 },
  emptyCard: { borderRadius: 17, padding: 16, backgroundColor: '#EEECE4' },
  emptyText: { color: '#666B62', lineHeight: 20 },
  boundaryCard: { borderRadius: 18, padding: 17, backgroundColor: '#E7EFE9' },
  boundaryText: { color: '#3E5547', lineHeight: 21 },
  boundaryStrong: { fontWeight: '800' },
  disabled: { opacity: 0.5 },
})

import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  loadTerritoryContext,
  searchNationalTerritories,
  type TerritoryOption,
} from '../lib/territory-context'

interface Props {
  value: TerritoryOption | null
  onChange: (territory: TerritoryOption, source: 'manual' | 'gps') => void
  label?: string
}

export function TerritoryTargetPicker({ value, onChange, label = 'Territorio de la contribución' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TerritoryOption[]>([])
  const [searching, setSearching] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (value) return
    let cancelled = false
    void loadTerritoryContext()
      .then((context) => {
        if (cancelled || !context.active) return
        onChange({
          code: context.active.territory_code,
          external_code: null,
          name: context.active.territory_name,
          level: context.active.territory_level,
          parent_code: context.active.department_code,
          country_code: 'CO',
        }, 'manual')
        setHint(context.active.is_home_fallback
          ? 'Usamos tu territorio de origen como punto de partida. Puedes escoger cualquier otro municipio colombiano.'
          : 'Usamos tu contexto territorial reciente como punto de partida. Puedes cambiarlo para esta contribución.')
      })
      .catch(() => null)
    return () => { cancelled = true }
  }, [onChange, value])

  async function search() {
    if (query.trim().length < 2) {
      setHint('Escribe al menos 2 caracteres del municipio o distrito.')
      return
    }
    setSearching(true)
    try {
      const found = await searchNationalTerritories(query)
      setResults(found)
      setHint(found.length ? '' : 'No encontramos ese municipio. Verifica el nombre o código DANE.')
    } catch (cause) {
      setHint(cause instanceof Error ? cause.message : 'No fue posible consultar el catálogo territorial.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.explainer}>
        Tu ciudad de registro no te limita. Indica dónde ocurre o a qué territorio colombiano pertenece este aporte.
      </Text>

      {value ? (
        <View style={styles.selected}>
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedName}>{value.name}</Text>
            <Text style={styles.selectedMeta}>{value.external_code ? `DANE ${value.external_code} · ` : ''}{value.level === 'district' ? 'Distrito' : 'Municipio'}</Text>
          </View>
          <Pressable onPress={() => { setResults([]); setQuery(value.name) }}>
            <Text style={styles.change}>Cambiar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Ej. Medellín, Cali, Pasto…"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={() => void search()}
        />
        <Pressable disabled={searching} style={styles.searchButton} onPress={() => void search()}>
          <Text style={styles.searchButtonText}>{searching ? '…' : 'Buscar'}</Text>
        </Pressable>
      </View>

      {results.length ? (
        <View style={styles.results}>
          {results.slice(0, 8).map((territory) => (
            <Pressable
              key={territory.code}
              style={styles.result}
              onPress={() => {
                onChange(territory, 'manual')
                setQuery('')
                setResults([])
                setHint('El territorio objetivo quedó seleccionado. Tu territorio de origen no cambió.')
              }}
            >
              <Text style={styles.resultName}>{territory.name}</Text>
              <Text style={styles.resultMeta}>{territory.external_code ? `DANE ${territory.external_code}` : territory.code}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: '#565D54', fontWeight: '700', fontSize: 12 },
  explainer: { color: '#6D7168', fontSize: 12, lineHeight: 17 },
  selected: { backgroundColor: '#EEF3EF', borderWidth: 1, borderColor: '#CAD9CC', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedCopy: { flex: 1, gap: 2 },
  selectedName: { color: '#17382A', fontWeight: '800' },
  selectedMeta: { color: '#647067', fontSize: 11 },
  change: { color: '#1C3D2E', fontWeight: '800', fontSize: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7D3C7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#171A15' },
  searchButton: { backgroundColor: '#17382A', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  searchButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  results: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E0DDD2' },
  result: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEEAE0' },
  resultName: { color: '#171A15', fontWeight: '700' },
  resultMeta: { color: '#777B74', fontSize: 11, marginTop: 2 },
  hint: { color: '#6D7168', fontSize: 11, lineHeight: 16 },
})

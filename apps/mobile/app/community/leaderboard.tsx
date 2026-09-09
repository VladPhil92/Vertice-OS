import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type { ApiList, CivicLeaderEntry } from '../../types/api'

export default function CommunityLeaderboardScreen() {
  const [leaders, setLeaders] = useState<CivicLeaderEntry[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<CivicLeaderEntry>>('/community/leaderboard?limit=30')
      setLeaders(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el ranking.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>GESTIÓN VERIFICABLE</Text>
            <Text style={styles.title}>Ranking cívico</Text>
          </View>
        </View>

        <View style={styles.neutralityNote}>
          <Text style={styles.neutralityText}>
            Basado en acciones, evidencia y resultados verificados. Excluye seguidores, likes, impresiones y
            corroboraciones comunitarias. Solo perfiles publicados voluntariamente.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.list}>
          {leaders.map((leader) => (
            <Pressable key={leader.citizen_id} style={styles.card} onPress={() => router.push(`/community/${leader.citizen_id}`)}>
              <Text style={styles.rank}>#{leader.rank}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{leader.display_name}</Text>
                <Text style={styles.muted}>
                  {leader.neighborhood ?? 'Sin barrio'}
                  {leader.organization ? ` · ${leader.organization}` : ''}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{leader.actions_count} acciones</Text>
                  <Text style={styles.meta}>{leader.verified_actions} verificadas</Text>
                </View>
              </View>
              <Text style={styles.score}>{leader.leader_score}</Text>
            </Pressable>
          ))}
          {!error && leaders.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay suficiente actividad para un ranking.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: '#E7E4D8' },
  backText: { color: '#263228', fontWeight: '700', fontSize: 12 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#697068', fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700', color: '#11130F' },
  neutralityNote: { backgroundColor: '#EEF3EF', borderRadius: 14, padding: 12 },
  neutralityText: { color: '#3F5B4B', fontSize: 12, lineHeight: 17 },
  list: { gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 32, fontSize: 16, fontWeight: '800', color: '#8FA696' },
  cardBody: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700', color: '#171A15' },
  muted: { color: '#70746C', fontSize: 12 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  meta: { color: '#596057', fontSize: 11 },
  score: { fontSize: 20, fontWeight: '800', color: '#1C3D2E' },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 20 },
})

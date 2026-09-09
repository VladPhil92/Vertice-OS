import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type { CivicActivity, CommunityFeedResponse } from '../../types/api'

type FeedScope = 'discover' | 'following'

interface FollowingFeedResponse {
  data: CivicActivity[]
  count: number
  scope: 'following'
}

const DEFAULT_SCORING_NOTE =
  'El score prioriza evidencia y resultados. Seguidores, likes y popularidad no suman puntos.'

const TYPE_LABEL: Record<string, string> = {
  report: 'Reporte',
  proposal: 'Propuesta',
  publication: 'Publicación',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'hace instantes'
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export default function CommunityScreen() {
  const [scope, setScope] = useState<FeedScope>('discover')
  const [activities, setActivities] = useState<CivicActivity[]>([])
  const [degraded, setDegraded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scoringNote, setScoringNote] = useState(DEFAULT_SCORING_NOTE)
  const latestScopeRef = useRef<FeedScope>('discover')

  const load = useCallback(async (nextScope: FeedScope) => {
    latestScopeRef.current = nextScope
    setError(null)
    try {
      if (nextScope === 'discover') {
        const response = await apiFetch<CommunityFeedResponse>('/community/feed?limit=40')
        if (latestScopeRef.current !== nextScope) return
        setActivities(response.data)
        setDegraded(response.availability.degraded)
        setScoringNote(response.scoring.note)
      } else {
        const response = await apiFetch<FollowingFeedResponse>('/community/following/feed?limit=40')
        if (latestScopeRef.current !== nextScope) return
        setActivities(response.data)
        setDegraded(false)
        setScoringNote(DEFAULT_SCORING_NOTE)
      }
    } catch (cause) {
      if (latestScopeRef.current !== nextScope) return
      setActivities([])
      setDegraded(false)
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la actividad comunitaria.')
    }
  }, [])

  useEffect(() => { void load(scope) }, [load, scope])

  async function refresh() {
    setRefreshing(true)
    try { await load(scope) } finally { setRefreshing(false) }
  }

  function openActor(activity: CivicActivity) {
    if (activity.actor.id) router.push(`/community/${activity.actor.id}`)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>RED CÍVICA</Text>
            <Text style={styles.title}>Comunidad</Text>
            <Text style={styles.subtitle}>Actividad verificable de gestores, líderes y organizaciones.</Text>
          </View>
          <Pressable style={styles.rankButton} onPress={() => router.push('/community/leaderboard')}>
            <Text style={styles.rankButtonText}>Ranking</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, scope === 'discover' && styles.tabButtonActive]}
            onPress={() => setScope('discover')}
          >
            <Text style={[styles.tabButtonText, scope === 'discover' && styles.tabButtonTextActive]}>Descubrir</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, scope === 'following' && styles.tabButtonActive]}
            onPress={() => setScope('following')}
          >
            <Text style={[styles.tabButtonText, scope === 'following' && styles.tabButtonTextActive]}>Siguiendo</Text>
          </Pressable>
        </View>

        <View style={styles.neutralityNote}>
          <Text style={styles.neutralityText}>{scoringNote}</Text>
        </View>

        {degraded ? (
          <View style={styles.degradedNote}>
            <Text style={styles.degradedText}>Parte del feed está temporalmente degradado. Mostrando lo disponible.</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.list}>
          {activities.map((activity) => (
            <Pressable
              key={`${activity.type}-${activity.id}`}
              style={styles.card}
              disabled={!activity.actor.id}
              onPress={() => openActor(activity)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.type}>{TYPE_LABEL[activity.type] ?? activity.type}</Text>
                <Text style={styles.score}>{activity.civic_score}</Text>
              </View>
              <Text style={styles.cardTitle}>{activity.title}</Text>
              <Text style={styles.muted}>
                {activity.actor.display_name}
                {activity.actor.neighborhood ? ` · ${activity.actor.neighborhood}` : ''}
              </Text>
              <Text style={styles.body} numberOfLines={3}>{activity.summary}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Evidencias: {activity.evidence_count}</Text>
                <Text style={styles.meta}>
                  {activity.community_validation.corroborations} corroboraciones
                </Text>
                <Text style={styles.meta}>{timeAgo(activity.updated_at)}</Text>
              </View>
            </Pressable>
          ))}
          {!error && activities.length === 0 ? (
            <Text style={styles.empty}>
              {scope === 'following'
                ? 'Aún no sigues a nadie. Descubre gestores y organizaciones en "Descubrir".'
                : 'Todavía no hay actividad cívica registrada en esta vista.'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: '#697068' },
  title: { fontSize: 28, fontWeight: '700', color: '#11130F' },
  subtitle: { color: '#6D7168', lineHeight: 20 },
  rankButton: { borderWidth: 1, borderColor: '#AEB7AF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  rankButtonText: { color: '#17382A', fontWeight: '700', fontSize: 12 },
  tabRow: { flexDirection: 'row', gap: 8, backgroundColor: '#E7E4D8', borderRadius: 14, padding: 4 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#17382A' },
  tabButtonText: { color: '#4B4F47', fontWeight: '700', fontSize: 12 },
  tabButtonTextActive: { color: '#FFFFFF' },
  neutralityNote: { backgroundColor: '#EEF3EF', borderRadius: 14, padding: 12 },
  neutralityText: { color: '#3F5B4B', fontSize: 12, lineHeight: 17 },
  degradedNote: { backgroundColor: '#FBF2DC', borderRadius: 14, padding: 12 },
  degradedText: { color: '#7A5B12', fontSize: 12, lineHeight: 17 },
  list: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '700' },
  score: { fontSize: 22, color: '#1C3D2E', fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#171A15' },
  muted: { color: '#70746C' },
  body: { color: '#343931', lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  meta: { color: '#596057', fontSize: 12 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
})

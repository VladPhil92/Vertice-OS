import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
import type { CivicActivity, CommunityFeedResponse } from '../../types/api'
import type { CommunityPolicyState } from '../../types/community-safety'

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
  const [policy, setPolicy] = useState<CommunityPolicyState | null>(null)
  const [policyBusy, setPolicyBusy] = useState(false)
  const latestScopeRef = useRef<FeedScope>('discover')

  const loadPolicy = useCallback(async () => {
    try {
      setPolicy(await apiFetch<CommunityPolicyState>('/community/safety/policy'))
    } catch {
      setPolicy(null)
    }
  }, [])

  const load = useCallback(async (nextScope: FeedScope) => {
    latestScopeRef.current = nextScope
    setError(null)
    try {
      if (nextScope === 'discover') {
        const response = await apiFetch<CommunityFeedResponse>('/community/feed/me?limit=40')
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
  useEffect(() => { void loadPolicy() }, [loadPolicy])

  async function refresh() {
    setRefreshing(true)
    try { await Promise.all([load(scope), loadPolicy()]) } finally { setRefreshing(false) }
  }

  function openActor(activity: CivicActivity) {
    if (activity.actor.id) router.push(`/community/${activity.actor.id}`)
  }

  function reportActivity(activity: CivicActivity) {
    router.push({
      pathname: '/community/report',
      params: {
        targetType: activity.type,
        targetId: activity.id,
        label: activity.title,
      },
    })
  }

  async function openGuidelines() {
    const url = policy?.guidelines_url ?? 'https://vertice.ctgone.com/community-guidelines'
    await Linking.openURL(url)
  }

  async function acceptPolicy() {
    if (!policy || policyBusy) return
    setPolicyBusy(true)
    setError(null)
    try {
      const next = await apiMutation<CommunityPolicyState>(
        '/community/safety/policy/accept',
        `mobile-community-policy-${policy.current_version}`,
        {
          method: 'POST',
          body: JSON.stringify({ policy_version: policy.current_version }),
        },
      )
      setPolicy(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar la aceptación de las normas.')
    } finally {
      setPolicyBusy(false)
    }
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

        {policy && !policy.accepted ? (
          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>Normas de Comunidad</Text>
            <Text style={styles.policyText}>
              Antes de publicar contenido debes revisar y aceptar las normas contra acoso, odio, amenazas, contenido sexual indebido, spam, suplantación y exposición de datos personales.
            </Text>
            <View style={styles.policyActions}>
              <Pressable style={styles.policySecondary} onPress={() => void openGuidelines()}>
                <Text style={styles.policySecondaryText}>Leer normas</Text>
              </Pressable>
              <Pressable disabled={policyBusy} style={[styles.policyPrimary, policyBusy && styles.disabled]} onPress={() => void acceptPolicy()}>
                <Text style={styles.policyPrimaryText}>{policyBusy ? 'Guardando…' : 'Acepto las normas'}</Text>
              </Pressable>
            </View>
          </View>
        ) : policy?.accepted ? (
          <Pressable style={styles.policyAccepted} onPress={() => void openGuidelines()}>
            <Text style={styles.policyAcceptedText}>Normas de Comunidad aceptadas · Ver política</Text>
          </Pressable>
        ) : null}

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
            <View key={`${activity.type}-${activity.id}`} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.type}>{TYPE_LABEL[activity.type] ?? activity.type}</Text>
                <Text style={styles.score}>{activity.civic_score}</Text>
              </View>
              <Text style={styles.cardTitle}>{activity.title}</Text>
              {activity.actor.id ? (
                <Pressable onPress={() => openActor(activity)}>
                  <Text style={styles.actorLink}>
                    {activity.actor.display_name}
                    {activity.actor.neighborhood ? ` · ${activity.actor.neighborhood}` : ''}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.muted}>{activity.actor.display_name}</Text>
              )}
              <Text style={styles.body} numberOfLines={3}>{activity.summary}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Evidencias: {activity.evidence_count}</Text>
                <Text style={styles.meta}>{activity.community_validation.corroborations} corroboraciones</Text>
                <Text style={styles.meta}>{timeAgo(activity.updated_at)}</Text>
              </View>
              <View style={styles.safetyRow}>
                {activity.actor.id ? (
                  <Pressable onPress={() => openActor(activity)} style={styles.textButton}>
                    <Text style={styles.textButtonText}>Ver perfil</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => reportActivity(activity)} style={styles.reportButton}>
                  <Text style={styles.reportButtonText}>Reportar</Text>
                </Pressable>
              </View>
            </View>
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
  policyCard: { backgroundColor: '#FFF8E8', borderRadius: 18, padding: 15, gap: 10, borderWidth: 1, borderColor: '#E5D9B6' },
  policyTitle: { color: '#493B17', fontWeight: '800', fontSize: 15 },
  policyText: { color: '#62552E', lineHeight: 18, fontSize: 12 },
  policyActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  policySecondary: { borderWidth: 1, borderColor: '#766423', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  policySecondaryText: { color: '#66551A', fontWeight: '700', fontSize: 12 },
  policyPrimary: { backgroundColor: '#17382A', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  policyPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  policyAccepted: { backgroundColor: '#EEF3EF', borderRadius: 12, padding: 11 },
  policyAcceptedText: { color: '#3F5B4B', fontSize: 12, fontWeight: '700' },
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
  actorLink: { color: '#1C3D2E', fontWeight: '700' },
  muted: { color: '#70746C' },
  body: { color: '#343931', lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  meta: { color: '#596057', fontSize: 12 },
  safetyRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  textButton: { paddingHorizontal: 10, paddingVertical: 8 },
  textButtonText: { color: '#3F5B4B', fontWeight: '700', fontSize: 12 },
  reportButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5ECEA' },
  reportButtonText: { color: '#853B35', fontWeight: '800', fontSize: 12 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
  disabled: { opacity: 0.55 },
})

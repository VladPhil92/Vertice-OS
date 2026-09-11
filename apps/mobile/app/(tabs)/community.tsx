import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { apiFetch, apiMutation } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
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
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        )}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <VerticeBrand variant="symbol" width={40} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>RED CÍVICA</Text>
            <Text style={styles.title}>Comunidad</Text>
            <Text style={styles.subtitle}>Actividad verificable de gestores, líderes y organizaciones.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.rankButton, pressed && styles.pressed]}
            onPress={() => router.push('/community/leaderboard')}
          >
            <Text style={styles.rankButtonText}>Ranking</Text>
          </Pressable>
        </View>

        {policy && !policy.accepted ? (
          <View style={styles.policyCard}>
            <View style={styles.policyAccent} />
            <Text style={styles.policyTitle}>Normas de Comunidad</Text>
            <Text style={styles.policyText}>
              Antes de publicar contenido debes revisar y aceptar las normas contra acoso, odio, amenazas, contenido sexual indebido, spam, suplantación y exposición de datos personales.
            </Text>
            <View style={styles.policyActions}>
              <Pressable style={({ pressed }) => [styles.policySecondary, pressed && styles.pressed]} onPress={() => void openGuidelines()}>
                <Text style={styles.policySecondaryText}>Leer normas</Text>
              </Pressable>
              <Pressable
                disabled={policyBusy}
                style={({ pressed }) => [styles.policyPrimary, pressed && styles.pressed, policyBusy && styles.disabled]}
                onPress={() => void acceptPolicy()}
              >
                <Text style={styles.policyPrimaryText}>{policyBusy ? 'Guardando…' : 'Acepto las normas'}</Text>
              </Pressable>
            </View>
          </View>
        ) : policy?.accepted ? (
          <Pressable style={({ pressed }) => [styles.policyAccepted, pressed && styles.pressed]} onPress={() => void openGuidelines()}>
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
          <Text style={styles.neutralityLabel}>CRITERIO DE SCORE</Text>
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
                <View style={styles.scorePill}>
                  <Text style={styles.score}>{activity.civic_score}</Text>
                </View>
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
                <Text style={styles.meta}>Evidencias · {activity.evidence_count}</Text>
                <Text style={styles.meta}>{activity.community_validation.corroborations} corroboraciones</Text>
                <Text style={styles.meta}>{timeAgo(activity.updated_at)}</Text>
              </View>
              <View style={styles.safetyRow}>
                {activity.actor.id ? (
                  <Pressable onPress={() => openActor(activity)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                    <Text style={styles.textButtonText}>Ver perfil</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => reportActivity(activity)} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.md },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  headerBrand: { borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs },
  headerCopy: { flex: 1, gap: spacing.xxs },
  eyebrow: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.title },
  subtitle: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  rankButton: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rankButtonText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  policyCard: { overflow: 'hidden', backgroundColor: colors.warningBackground, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.warningBorder },
  policyAccent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: colors.citizen },
  policyTitle: { color: colors.warningText, fontFamily: typography.displayFamily, fontSize: 15, fontWeight: '800' },
  policyText: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 18 },
  policyActions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  policySecondary: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.warningText, borderRadius: radius.md, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  policySecondaryText: { color: colors.warningText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  policyPrimary: { minHeight: interaction.minimumTouchTarget, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center' },
  policyPrimaryText: { color: colors.white, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  policyAccepted: { backgroundColor: colors.successBackground, borderWidth: 1, borderColor: colors.successBorder, borderRadius: radius.md, padding: spacing.sm },
  policyAcceptedText: { color: colors.successText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  tabRow: { flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.xxs },
  tabButton: { flex: 1, minHeight: interaction.minimumTouchTarget, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: colors.navy },
  tabButtonText: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  tabButtonTextActive: { color: colors.white },
  neutralityNote: { backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xxs },
  neutralityLabel: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  neutralityText: { color: colors.infoText, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 17 },
  degradedNote: { backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: radius.md, padding: spacing.sm },
  degradedText: { color: colors.warningText, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 17 },
  list: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, ...elevation.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  scorePill: { minWidth: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, alignItems: 'center' },
  score: { color: colors.navy, fontFamily: typography.displayFamily, fontSize: 18, fontWeight: '800' },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 16, fontWeight: '800' },
  actorLink: { color: colors.navyLight, fontFamily: typography.bodyBoldFamily, fontWeight: '700' },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  meta: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12 },
  safetyRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.xxs },
  textButton: { minHeight: interaction.minimumTouchTarget, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  textButtonText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  reportButton: { minHeight: interaction.minimumTouchTarget, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.errorBackground, justifyContent: 'center' },
  reportButtonText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  error: { color: colors.errorText, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, padding: spacing.sm, fontFamily: typography.bodyFamily },
  empty: { textAlign: 'center', color: colors.textTertiary, fontFamily: typography.bodyFamily, paddingVertical: spacing.xxl },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

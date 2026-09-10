import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
import type { FollowState, PublicCivicProfile } from '../../types/api'
import type { CommunityBlockState } from '../../types/community-safety'

const PROFILE_TYPE_LABEL: Record<string, string> = {
  citizen: 'Ciudadano',
  social_leader: 'Líder social',
  candidate: 'Candidato/a',
  organization_rep: 'Representante de organización',
  public_official: 'Funcionario público',
}

export default function CivicProfileScreen() {
  const { citizenId } = useLocalSearchParams<{ citizenId: string }>()
  const [profile, setProfile] = useState<PublicCivicProfile | null>(null)
  const [followState, setFollowState] = useState<FollowState | null>(null)
  const [blockState, setBlockState] = useState<CommunityBlockState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!citizenId) return
    setError(null)
    try {
      const profileResponse = await apiFetch<PublicCivicProfile>(`/community/profiles/${citizenId}`)
      setProfile(profileResponse)

      const block = await apiFetch<CommunityBlockState>(`/community/profiles/${citizenId}/block-state`).catch(() => null)
      if (block) setBlockState(block)

      if (!block?.blocked) {
        const follow = await apiFetch<FollowState>(`/community/profiles/${citizenId}/follow-state`).catch(() => null)
        setFollowState(follow)
      } else {
        setFollowState(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar este perfil cívico.')
    }
  }, [citizenId])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function toggleFollow() {
    if (!citizenId || !followState || blockState?.blocked) return
    setFollowBusy(true)
    setError(null)
    try {
      const next = followState.following
        ? await apiFetch<FollowState>(`/community/profiles/${citizenId}/follow`, { method: 'DELETE' })
        : await apiMutation<FollowState>(`/community/profiles/${citizenId}/follow`, 'mobile-follow', { method: 'POST' })
      setFollowState(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el seguimiento.')
    } finally {
      setFollowBusy(false)
    }
  }

  function reportProfile() {
    if (!citizenId) return
    router.push({
      pathname: '/community/report',
      params: {
        targetType: 'profile',
        targetId: citizenId,
        label: profile?.display_name ?? 'Perfil cívico',
      },
    })
  }

  async function unblockUser() {
    if (!citizenId || blockBusy) return
    setBlockBusy(true)
    setError(null)
    try {
      const next = await apiFetch<CommunityBlockState>(`/community/profiles/${citizenId}/block`, { method: 'DELETE' })
      setBlockState(next)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo desbloquear este perfil.')
    } finally {
      setBlockBusy(false)
    }
  }

  async function blockUser() {
    if (!citizenId || blockBusy) return
    setBlockBusy(true)
    setError(null)
    try {
      const next = await apiMutation<CommunityBlockState>(
        `/community/profiles/${citizenId}/block`,
        `mobile-community-block-${citizenId}`,
        { method: 'POST' },
      )
      setBlockState(next)
      setFollowState(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo bloquear este perfil.')
    } finally {
      setBlockBusy(false)
    }
  }

  function confirmBlock() {
    Alert.alert(
      'Bloquear usuario',
      'Dejarán de seguirse mutuamente y el contenido de este perfil dejará de aparecer en tu experiencia comunitaria. Puedes desbloquearlo después.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: () => { void blockUser() } },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {profile ? (
          <>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>{PROFILE_TYPE_LABEL[profile.profile_type] ?? profile.profile_type}</Text>
              <Text style={styles.name}>{profile.display_name ?? 'Perfil cívico'}</Text>
              {profile.neighborhood ? <Text style={styles.muted}>{profile.neighborhood}</Text> : null}
              {profile.organization ? <Text style={styles.muted}>{profile.organization}</Text> : null}
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

              {!blockState?.blocked && followState ? (
                <Pressable
                  disabled={followBusy}
                  onPress={() => void toggleFollow()}
                  style={[styles.followButton, followState.following && styles.followButtonActive, followBusy && styles.disabled]}
                >
                  <Text style={[styles.followButtonText, followState.following && styles.followButtonTextActive]}>
                    {followBusy ? 'Procesando…' : followState.following ? 'Dejar de seguir' : 'Seguir'}
                  </Text>
                </Pressable>
              ) : null}

              {blockState?.blocked ? (
                <View style={styles.blockedNote}>
                  <Text style={styles.blockedTitle}>Usuario bloqueado</Text>
                  <Text style={styles.blockedText}>Su contenido y las interacciones sociales entre ambos están limitados.</Text>
                </View>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{followState?.follower_count ?? profile.follower_count}</Text>
                  <Text style={styles.statLabel}>Seguidores</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{profile.actions_count}</Text>
                  <Text style={styles.statLabel}>Acciones</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{profile.verified_actions}</Text>
                  <Text style={styles.statLabel}>Verificadas</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{profile.average_action_score}</Text>
                  <Text style={styles.statLabel}>Score medio</Text>
                </View>
              </View>
            </View>

            <View style={styles.neutralityNote}>
              <Text style={styles.neutralityText}>
                Seguir, bloquear o denunciar un perfil son controles sociales y de seguridad. No otorgan ni descuentan reputación, identidad o autoridad cívica automáticamente.
              </Text>
            </View>

            <View style={styles.safetyCard}>
              <Text style={styles.sectionTitle}>Seguridad</Text>
              <Text style={styles.safetyText}>Puedes denunciar este perfil para revisión o bloquear la interacción directamente.</Text>
              <View style={styles.safetyActions}>
                <Pressable style={styles.reportButton} onPress={reportProfile}>
                  <Text style={styles.reportButtonText}>Reportar usuario</Text>
                </Pressable>
                {blockState?.blocked ? (
                  <Pressable disabled={blockBusy} style={[styles.unblockButton, blockBusy && styles.disabled]} onPress={() => void unblockUser()}>
                    <Text style={styles.unblockButtonText}>{blockBusy ? 'Procesando…' : 'Desbloquear usuario'}</Text>
                  </Pressable>
                ) : (
                  <Pressable disabled={blockBusy} style={[styles.blockButton, blockBusy && styles.disabled]} onPress={confirmBlock}>
                    <Text style={styles.blockButtonText}>{blockBusy ? 'Procesando…' : 'Bloquear usuario'}</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Acciones recientes</Text>
            <View style={styles.list}>
              {profile.recent_actions.map((activity) => (
                <View key={`${activity.type}-${activity.id}`} style={styles.actionCard}>
                  <View style={styles.cardTop}>
                    <Text style={styles.type}>{activity.category}</Text>
                    <Text style={styles.score}>{activity.civic_score}</Text>
                  </View>
                  <Text style={styles.actionTitle}>{activity.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>{activity.summary}</Text>
                  <Pressable
                    style={styles.inlineReport}
                    onPress={() => router.push({
                      pathname: '/community/report',
                      params: {
                        targetType: activity.type,
                        targetId: activity.id,
                        label: activity.title,
                      },
                    })}
                  >
                    <Text style={styles.inlineReportText}>Reportar</Text>
                  </Pressable>
                </View>
              ))}
              {profile.recent_actions.length === 0 ? (
                <Text style={styles.empty}>Todavía no hay acciones públicas registradas.</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: '#E7E4D8' },
  backText: { color: '#263228', fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#697068', fontWeight: '700', textTransform: 'uppercase' },
  name: { fontSize: 24, fontWeight: '700', color: '#11130F' },
  muted: { color: '#70746C' },
  bio: { color: '#343931', lineHeight: 20, marginTop: 6 },
  followButton: { marginTop: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#17382A' },
  followButtonActive: { backgroundColor: '#17382A' },
  followButtonText: { color: '#17382A', fontWeight: '700' },
  followButtonTextActive: { color: '#FFFFFF' },
  disabled: { opacity: 0.55 },
  blockedNote: { marginTop: 10, borderRadius: 14, padding: 12, backgroundColor: '#F4EFE8', gap: 3 },
  blockedTitle: { color: '#503F2B', fontWeight: '800', fontSize: 13 },
  blockedText: { color: '#6E5A43', fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  stat: { alignItems: 'center', gap: 3 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1C3D2E' },
  statLabel: { fontSize: 11, color: '#6D7168' },
  neutralityNote: { backgroundColor: '#EEF3EF', borderRadius: 14, padding: 12 },
  neutralityText: { color: '#3F5B4B', fontSize: 12, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#171A15' },
  safetyCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, gap: 9 },
  safetyText: { color: '#656A63', fontSize: 12, lineHeight: 18 },
  safetyActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reportButton: { backgroundColor: '#F5ECEA', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11 },
  reportButtonText: { color: '#853B35', fontWeight: '800', fontSize: 12 },
  blockButton: { backgroundColor: '#782E2A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11 },
  blockButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  unblockButton: { borderWidth: 1, borderColor: '#53635A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11 },
  unblockButtonText: { color: '#425149', fontWeight: '800', fontSize: 12 },
  list: { gap: 10 },
  actionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#667067', fontWeight: '700' },
  score: { fontSize: 18, color: '#1C3D2E', fontWeight: '800' },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#171A15' },
  body: { color: '#343931', lineHeight: 18, fontSize: 13 },
  inlineReport: { alignSelf: 'flex-end', marginTop: 2, paddingHorizontal: 8, paddingVertical: 6 },
  inlineReportText: { color: '#853B35', fontWeight: '700', fontSize: 11 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 20 },
})

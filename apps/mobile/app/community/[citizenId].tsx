import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch, apiMutation } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { CivicActivity, FollowState, PublicCivicProfile } from '../../types/api'
import type { CommunityBlockState } from '../../types/community-safety'

const PROFILE_TYPE_LABEL: Record<string, string> = {
  citizen: 'Ciudadano',
  social_leader: 'Líder social',
  candidate: 'Candidato/a',
  organization_rep: 'Representante de organización',
  public_official: 'Funcionario público',
}

function activityIcon(type: CivicActivity['type']) {
  if (type === 'report') return 'report' as const
  if (type === 'proposal') return 'governance' as const
  return 'signal' as const
}

function verificationLabel(state: CivicActivity['verification_state']) {
  if (state === 'verified') return 'Verificada'
  if (state === 'evidence_backed') return 'Con evidencia'
  return 'Declarada'
}

function verificationIcon(state: CivicActivity['verification_state']) {
  if (state === 'verified') return 'verified' as const
  if (state === 'evidence_backed') return 'evidence' as const
  return 'circle' as const
}

function verificationColor(state: CivicActivity['verification_state']) {
  if (state === 'verified') return colors.successText
  if (state === 'evidence_backed') return colors.infoText
  return colors.textTertiary
}

export default function CivicProfileScreen() {
  const params = useLocalSearchParams<{ citizenId?: string | string[] }>()
  const citizenId = useMemo(() => Array.isArray(params.citizenId) ? params.citizenId[0] : params.citizenId, [params.citizenId])
  const [profile, setProfile] = useState<PublicCivicProfile | null>(null)
  const [followState, setFollowState] = useState<FollowState | null>(null)
  const [blockState, setBlockState] = useState<CommunityBlockState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followBusy, setFollowBusy] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!citizenId) {
      setError('Perfil cívico inválido.')
      setLoading(false)
      return
    }
    setError(null)
    try {
      const profileResponse = await apiFetch<PublicCivicProfile>(`/community/profiles/${citizenId}`)
      setProfile(profileResponse)

      const block = await apiFetch<CommunityBlockState>(`/community/profiles/${citizenId}/block-state`).catch(() => null)
      setBlockState(block)

      if (!block?.blocked) {
        const follow = await apiFetch<FollowState>(`/community/profiles/${citizenId}/follow-state`).catch(() => null)
        setFollowState(follow)
      } else {
        setFollowState(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar este perfil cívico.')
    } finally {
      setLoading(false)
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}
      >
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="community" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>COMUNIDAD</Text>
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

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="profile" color={colors.azure} size={24} />
            <Text style={styles.muted}>Cargando perfil cívico…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <VerticeIcon name="refresh" color={colors.navy} size={18} />
              <Text style={styles.secondaryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {profile ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.profileIcon}>
                <VerticeIcon name="profile" color={colors.white} size={26} />
              </View>
              <Text style={styles.eyebrow}>{PROFILE_TYPE_LABEL[profile.profile_type] ?? profile.profile_type}</Text>
              <Text style={styles.name}>{profile.display_name ?? 'Perfil cívico'}</Text>
              {profile.neighborhood ? <Text style={styles.heroMeta}>{profile.neighborhood}</Text> : null}
              {profile.organization ? <Text style={styles.heroMeta}>{profile.organization}</Text> : null}
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

              {!blockState?.blocked && followState ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: followBusy, selected: followState.following }}
                  disabled={followBusy}
                  onPress={() => void toggleFollow()}
                  style={({ pressed }) => [
                    styles.followButton,
                    followState.following && styles.followButtonActive,
                    followBusy && styles.disabled,
                    pressed && !followBusy && styles.pressed,
                  ]}
                >
                  <VerticeIcon name={followState.following ? 'userMinus' : 'userPlus'} color={followState.following ? colors.white : colors.navy} size={18} />
                  <Text style={[styles.followButtonText, followState.following && styles.followButtonTextActive]}>
                    {followBusy ? 'Procesando…' : followState.following ? 'Dejar de seguir' : 'Seguir'}
                  </Text>
                </Pressable>
              ) : null}

              {blockState?.blocked ? (
                <View style={styles.blockedNote}>
                  <VerticeIcon name="block" color={colors.warningText} size={20} />
                  <View style={styles.blockedCopy}>
                    <Text style={styles.blockedTitle}>Usuario bloqueado</Text>
                    <Text style={styles.blockedText}>Su contenido y las interacciones sociales entre ambos están limitados.</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{followState?.follower_count ?? profile.follower_count}</Text>
                <Text style={styles.statLabel}>Seguidores</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.actions_count}</Text>
                <Text style={styles.statLabel}>Acciones</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.verified_actions}</Text>
                <Text style={styles.statLabel}>Verificadas</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.average_action_score}</Text>
                <Text style={styles.statLabel}>Score medio</Text>
              </View>
            </View>

            <View style={styles.boundaryCard}>
              <VerticeIcon name="shield" color={colors.infoText} size={22} />
              <View style={styles.boundaryCopy}>
                <Text style={styles.boundaryKicker}>FRONTERA DE CONFIANZA</Text>
                <Text style={styles.boundaryText}>
                  Seguir a una persona no es respaldo político, voto ni transferencia de reputación. Bloquear o denunciar son controles de seguridad y tampoco modifican automáticamente identidad, reputación o autoridad cívica.
                </Text>
              </View>
            </View>

            <View style={styles.safetyCard}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}>
                  <VerticeIcon name="moderation" color={colors.navy} size={20} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionKicker}>SEGURIDAD</Text>
                  <Text style={styles.sectionTitle}>Controles sobre este perfil</Text>
                </View>
              </View>
              <Text style={styles.body}>Puedes enviar una denuncia para revisión de moderación o limitar la interacción directamente.</Text>
              <View style={styles.safetyActions}>
                <Pressable accessibilityRole="button" onPress={reportProfile} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                  <VerticeIcon name="flag" color={colors.errorText} size={18} />
                  <Text style={styles.reportButtonText}>Reportar usuario</Text>
                </Pressable>
                {blockState?.blocked ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: blockBusy }}
                    disabled={blockBusy}
                    onPress={() => void unblockUser()}
                    style={({ pressed }) => [styles.unblockButton, blockBusy && styles.disabled, pressed && !blockBusy && styles.pressed]}
                  >
                    <VerticeIcon name="unblock" color={colors.navy} size={18} />
                    <Text style={styles.unblockButtonText}>{blockBusy ? 'Procesando…' : 'Desbloquear usuario'}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: blockBusy }}
                    disabled={blockBusy}
                    onPress={confirmBlock}
                    style={({ pressed }) => [styles.blockButton, blockBusy && styles.disabled, pressed && !blockBusy && styles.pressed]}
                  >
                    <VerticeIcon name="block" color={colors.white} size={18} />
                    <Text style={styles.blockButtonText}>{blockBusy ? 'Procesando…' : 'Bloquear usuario'}</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}>
                <VerticeIcon name="actions" color={colors.navy} size={20} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionKicker}>TRAZABILIDAD CÍVICA</Text>
                <Text style={styles.sectionTitle}>Acciones recientes</Text>
              </View>
            </View>

            <View style={styles.list}>
              {profile.recent_actions.map((activity) => (
                <View key={`${activity.type}-${activity.id}`} style={styles.actionCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.activityTypeRow}>
                      <VerticeIcon name={activityIcon(activity.type)} color={colors.navy} size={16} />
                      <Text style={styles.type}>{activity.category}</Text>
                    </View>
                    <View style={styles.scoreGroup}>
                      <Text style={styles.score}>{activity.civic_score}</Text>
                      <Text style={styles.scoreLabel}>score</Text>
                    </View>
                  </View>
                  <Text style={styles.actionTitle}>{activity.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>{activity.summary}</Text>
                  <View style={styles.actionFooter}>
                    <View style={styles.verificationPill}>
                      <VerticeIcon name={verificationIcon(activity.verification_state)} color={verificationColor(activity.verification_state)} size={14} />
                      <Text style={styles.verificationText}>{verificationLabel(activity.verification_state)}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({
                        pathname: '/community/report',
                        params: {
                          targetType: activity.type,
                          targetId: activity.id,
                          label: activity.title,
                        },
                      })}
                      style={({ pressed }) => [styles.inlineReport, pressed && styles.pressed]}
                    >
                      <VerticeIcon name="flag" color={colors.errorText} size={15} />
                      <Text style={styles.inlineReportText}>Reportar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {profile.recent_actions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <VerticeIcon name="actions" color={colors.textTertiary} size={24} />
                  <Text style={styles.empty}>Todavía no hay acciones públicas registradas.</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
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
  stateCard: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBackground, padding: spacing.md, gap: spacing.sm },
  errorText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  heroCard: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  profileIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label, textTransform: 'uppercase' },
  name: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  heroMeta: { color: colors.white, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  bio: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  followButton: { minHeight: interaction.buttonHeight, marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.citizen, backgroundColor: colors.citizen },
  followButtonActive: { backgroundColor: colors.navyLight, borderColor: colors.white },
  followButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  followButtonTextActive: { color: colors.white },
  blockedNote: { marginTop: spacing.xs, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningBackground, padding: spacing.sm },
  blockedCopy: { flex: 1, gap: spacing.xxs },
  blockedTitle: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  blockedText: { color: colors.warningText, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 18 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '48%', minHeight: 100, justifyContent: 'center', borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  statValue: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  statLabel: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  boundaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  boundaryCopy: { flex: 1, gap: spacing.xxs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  safetyCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...elevation.card },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sectionCopy: { flex: 1, gap: spacing.xxs },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  safetyActions: { gap: spacing.xs },
  reportButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, paddingHorizontal: spacing.md },
  reportButtonText: { color: colors.errorText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  blockButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.red, paddingHorizontal: spacing.md },
  blockButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  unblockButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  unblockButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  list: { gap: spacing.sm },
  actionCard: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  activityTypeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  type: { flex: 1, textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  scoreGroup: { alignItems: 'flex-end' },
  score: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, fontSize: 20, lineHeight: 24, fontWeight: '800' },
  scoreLabel: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  actionTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  actionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  verificationPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  verificationText: { color: colors.infoText, fontFamily: typography.bodySemiboldFamily, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  inlineReport: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.xs },
  inlineReportText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  emptyCard: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  empty: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { ApiList, CivicLeaderEntry } from '../../types/api'

export default function CommunityLeaderboardScreen() {
  const [leaders, setLeaders] = useState<CivicLeaderEntry[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<CivicLeaderEntry>>('/community/leaderboard?limit=30')
      setLeaders(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el ranking.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
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
            <VerticeIcon name="leaderboard" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>CONFIANZA CÍVICA</Text>
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
            <VerticeIcon name="leaderboard" color={colors.white} size={26} />
          </View>
          <Text style={styles.eyebrow}>GESTIÓN VERIFICABLE</Text>
          <Text style={styles.title}>Ranking cívico</Text>
          <Text style={styles.heroBody}>
            Visibiliza actividad pública trazable y resultados verificados. No mide popularidad, intención de voto ni autoridad política.
          </Text>
        </View>

        <View style={styles.boundaryCard}>
          <VerticeIcon name="shield" color={colors.infoText} size={22} />
          <View style={styles.boundaryCopy}>
            <Text style={styles.boundaryKicker}>FRONTERA DEL RANKING</Text>
            <Text style={styles.boundaryText}>
              El leader score excluye seguidores, likes, impresiones y corroboraciones comunitarias. Seguir a un perfil no lo respalda políticamente ni aumenta su posición por sí solo.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="leaderboard" color={colors.azure} size={24} />
            <Text style={styles.stateText}>Cargando ranking cívico…</Text>
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

        <View style={styles.list}>
          {leaders.map((leader) => (
            <Pressable
              key={leader.citizen_id}
              accessibilityRole="button"
              accessibilityLabel={`${leader.display_name}, puesto ${leader.rank}, score ${leader.leader_score}, ${leader.actions_count} acciones, ${leader.verified_actions} verificadas. Abrir perfil`}
              onPress={() => router.push(`/community/${leader.citizen_id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rank}>#{leader.rank}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{leader.display_name}</Text>
                <Text style={styles.muted}>
                  {leader.neighborhood ?? 'Sin barrio'}
                  {leader.organization ? ` · ${leader.organization}` : ''}
                </Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <VerticeIcon name="actions" color={colors.infoText} size={14} />
                    <Text style={styles.meta}>{leader.actions_count} acciones</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <VerticeIcon name="verified" color={colors.successText} size={14} />
                    <Text style={styles.meta}>{leader.verified_actions} verificadas</Text>
                  </View>
                </View>
              </View>
              <View style={styles.scoreGroup}>
                <Text style={styles.score}>{leader.leader_score}</Text>
                <Text style={styles.scoreLabel}>score</Text>
                <VerticeIcon name="chevronRight" color={colors.textTertiary} size={18} />
              </View>
            </Pressable>
          ))}
          {!loading && !error && leaders.length === 0 ? (
            <View style={styles.emptyCard}>
              <VerticeIcon name="leaderboard" color={colors.textTertiary} size={26} />
              <Text style={styles.empty}>Todavía no hay suficiente actividad verificable para construir un ranking.</Text>
            </View>
          ) : null}
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
  heroIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  boundaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  boundaryCopy: { flex: 1, gap: spacing.xxs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  stateCard: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateText: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBackground, padding: spacing.md, gap: spacing.sm },
  errorText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  list: { gap: spacing.sm },
  card: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  rankBadge: { width: 46, height: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder },
  rank: { color: colors.warningText, fontFamily: typography.displayBoldFamily, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  cardBody: { flex: 1, gap: spacing.xxs },
  name: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  muted: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xxs },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  meta: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  scoreGroup: { alignItems: 'center', gap: spacing.xxs },
  score: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, fontSize: 22, lineHeight: 26, fontWeight: '800' },
  scoreLabel: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, fontSize: 9, lineHeight: 12, fontWeight: '600' },
  emptyCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  empty: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  pressed: { opacity: interaction.pressedOpacity },
})

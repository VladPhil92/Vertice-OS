import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { apiFetch, apiMutation } from '../../lib/api'
import {
  mobileEligibilityExperience,
  type GovernanceEligibility,
} from '../../lib/governance-eligibility'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { ApiList, EndorseResult, GovernanceProposal, VoteTally } from '../../types/api'

type VoteValue = -1 | 0 | 1

export default function GovernanceScreen() {
  const [proposals, setProposals] = useState<GovernanceProposal[]>([])
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({})
  const [eligibility, setEligibility] = useState<Record<string, GovernanceEligibility | null>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<GovernanceProposal>>('/governance/proposals?limit=30', { public: true })
      setProposals(response.data)

      const voting = response.data.filter((proposal) => proposal.status === 'voting')
      const [tallyResults, eligibilityResults] = await Promise.all([
        Promise.allSettled(
          voting.map(async (proposal) => [proposal.id, await apiFetch<VoteTally>(`/governance/proposals/${proposal.id}/tally`, { public: true })] as const),
        ),
        Promise.allSettled(
          voting.map(async (proposal) => [proposal.id, await apiFetch<GovernanceEligibility>(`/governance/proposals/${proposal.id}/eligibility`)] as const),
        ),
      ])

      const nextTallies: Record<string, VoteTally> = {}
      for (const result of tallyResults) {
        if (result.status === 'fulfilled') nextTallies[result.value[0]] = result.value[1]
      }
      setTallies(nextTallies)

      const nextEligibility: Record<string, GovernanceEligibility | null> = {}
      for (const result of eligibilityResults) {
        if (result.status === 'fulfilled') nextEligibility[result.value[0]] = result.value[1]
      }
      for (const proposal of voting) {
        if (!(proposal.id in nextEligibility)) nextEligibility[proposal.id] = null
      }
      setEligibility(nextEligibility)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar las propuestas.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function endorse(proposal: GovernanceProposal) {
    setBusyId(proposal.id)
    try {
      const result = await apiMutation<EndorseResult>(
        `/governance/proposals/${proposal.id}/endorse`,
        `mobile-endorse-${proposal.id}`,
        { method: 'POST', body: '{}' },
      )
      setProposals((current) => current.map((item) => item.id === proposal.id
        ? { ...item, endorsement_count: result.endorsement_count, status: result.status }
        : item))
    } catch (cause) {
      Alert.alert('No se pudo registrar el aval', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
    } finally {
      setBusyId(null)
    }
  }

  async function vote(proposal: GovernanceProposal, voteValue: VoteValue) {
    const preflight = eligibility[proposal.id]
    if (!preflight?.eligible) {
      Alert.alert('Voto bloqueado', 'VÉRTICE no pudo certificar tu elegibilidad server-side para esta votación.')
      return
    }

    setBusyId(proposal.id)
    try {
      await apiMutation(`/governance/proposals/${proposal.id}/vote`, `mobile-vote-${proposal.id}`, {
        method: 'POST',
        body: JSON.stringify({ vote_value: voteValue }),
      })
      const [tally, refreshedEligibility] = await Promise.all([
        apiFetch<VoteTally>(`/governance/proposals/${proposal.id}/tally`, { public: true }),
        apiFetch<GovernanceEligibility>(`/governance/proposals/${proposal.id}/eligibility`),
      ])
      setTallies((current) => ({ ...current, [proposal.id]: tally }))
      setEligibility((current) => ({ ...current, [proposal.id]: refreshedEligibility }))
      Alert.alert('Participación registrada', 'Tu voto fue procesado por el ledger de gobernanza.')
    } catch (cause) {
      await load()
      Alert.alert('No se pudo registrar el voto', cause instanceof Error ? cause.message : 'La elegibilidad pudo cambiar. Revisa el estado e intenta nuevamente.')
    } finally {
      setBusyId(null)
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
          <View style={styles.header}>
            <Text style={styles.eyebrow}>GOBERNANZA CÍVICA · PHASE 7G.3</Text>
            <Text style={styles.title}>Propuestas y decisiones</Text>
            <Text style={styles.subtitle}>
              La app consulta al servidor si perteneces al electorado de cada votación. Un perfil, GPS, reputación o pago nunca habilita un voto por sí solo.
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.list}>
          {proposals.map((proposal) => {
            const tally = tallies[proposal.id]
            const preflight = proposal.status === 'voting' ? eligibility[proposal.id] : undefined
            const experience = preflight ? mobileEligibilityExperience(preflight.reason_code) : null
            const busy = busyId === proposal.id
            const canEndorse = proposal.status === 'idea' || proposal.status === 'draft'
            const canVote = proposal.status === 'voting' && preflight?.eligible === true
            const approvalPercentage = tally?.approval_percentage == null ? '—' : `${tally.approval_percentage}%`
            const quorumLabel = tally?.quorum_reached == null
              ? 'sin cálculo'
              : tally.quorum_reached ? 'cumplido' : 'pendiente'

            return (
              <View key={proposal.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.status}>{proposal.status.replace(/_/g, ' ')}</Text>
                  <Text style={styles.scope}>{proposal.scope}</Text>
                </View>
                <Text style={styles.cardTitle}>{proposal.title}</Text>
                <Text style={styles.category}>{proposal.category.replace(/_/g, ' ')}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{proposal.endorsement_count} avales</Text>
                  <Text style={styles.meta}>{proposal.total_votes} votos</Text>
                </View>

                {tally ? (
                  <View style={styles.tallyBox}>
                    <Text style={styles.tallyKicker}>TALLY VERIFICABLE</Text>
                    <Text style={styles.tallyTitle}>{tally.total_votes} participantes</Text>
                    <Text style={styles.tallyLine}>A favor {tally.approve_weighted} · En contra {tally.reject_weighted} · Abstención {tally.abstain_weighted}</Text>
                    <Text style={styles.tallyLine}>Aprobación {approvalPercentage} · Quórum {quorumLabel}</Text>
                  </View>
                ) : null}

                {proposal.status === 'voting' ? (
                  preflight && experience ? (
                    <View style={[
                      styles.eligibilityBox,
                      experience.kind === 'positive' ? styles.eligibilityPositive
                        : experience.kind === 'warning' ? styles.eligibilityWarning
                          : styles.eligibilityBlocked,
                    ]}>
                      <Text style={styles.eligibilityTitle}>{experience.title}</Text>
                      <Text style={styles.eligibilityBody}>{experience.description}</Text>
                      <Text style={styles.eligibilityMeta}>
                        Autoridad: {preflight.authority === 'frozen_electorate' ? 'padrón congelado' : preflight.authority === 'current_assurance' ? 'assurance vigente' : 'sin autorización'}
                      </Text>
                      {!preflight.eligible && experience.actionRoute && experience.actionLabel ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => router.push(experience.actionRoute!)}
                          style={({ pressed }) => [styles.remediationButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.remediationButtonText}>{experience.actionLabel}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <View style={[styles.eligibilityBox, styles.eligibilityBlocked]}>
                      <Text style={styles.eligibilityTitle}>Elegibilidad no certificada</Text>
                      <Text style={styles.eligibilityBody}>Los controles permanecen bloqueados hasta obtener una respuesta server-side válida.</Text>
                    </View>
                  )
                ) : null}

                {canEndorse ? (
                  <Pressable disabled={busy} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, busy && styles.disabledBusy]} onPress={() => void endorse(proposal)}>
                    <Text style={styles.secondaryButtonText}>{busy ? 'Procesando…' : 'Avalar propuesta'}</Text>
                  </Pressable>
                ) : null}

                {proposal.status === 'voting' ? (
                  <View style={styles.voteRow}>
                    <Pressable disabled={busy || !canVote} style={({ pressed }) => [styles.voteButton, pressed && styles.pressed, !canVote && styles.disabled]} onPress={() => void vote(proposal, 1)}>
                      <Text style={styles.voteButtonText}>A favor</Text>
                    </Pressable>
                    <Pressable disabled={busy || !canVote} style={({ pressed }) => [styles.voteButton, pressed && styles.pressed, !canVote && styles.disabled]} onPress={() => void vote(proposal, -1)}>
                      <Text style={styles.voteButtonText}>En contra</Text>
                    </Pressable>
                    <Pressable disabled={busy || !canVote} style={({ pressed }) => [styles.voteButton, pressed && styles.pressed, !canVote && styles.disabled]} onPress={() => void vote(proposal, 0)}>
                      <Text style={styles.voteButtonText}>Abstenerme</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )
          })}
          {!error && proposals.length === 0 ? <Text style={styles.empty}>Aún no hay propuestas publicadas.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerBrand: { borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs },
  header: { flex: 1, gap: spacing.xxs },
  eyebrow: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.label },
  title: { color: colors.textPrimary, fontFamily: typography.displayFamily, ...typography.roles.title },
  subtitle: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  list: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, ...elevation.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { textTransform: 'uppercase', color: colors.navy, fontFamily: typography.bodyFamily, fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  scope: { textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 10, fontWeight: '700' },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 17, fontWeight: '800' },
  category: { textTransform: 'capitalize', color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  meta: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12 },
  tallyBox: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, borderRadius: radius.md, gap: spacing.xxs },
  tallyKicker: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  tallyTitle: { color: colors.textPrimary, fontFamily: typography.bodyFamily, fontWeight: '800', fontSize: 12 },
  tallyLine: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12 },
  eligibilityBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, gap: spacing.xs },
  eligibilityPositive: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  eligibilityWarning: { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder },
  eligibilityBlocked: { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder },
  eligibilityTitle: { color: colors.textPrimary, fontFamily: typography.bodyFamily, fontWeight: '800', fontSize: 13 },
  eligibilityBody: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 18 },
  eligibilityMeta: { color: colors.textTertiary, fontFamily: typography.monoFamily, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  remediationButton: { alignSelf: 'flex-start', minHeight: interaction.minimumTouchTarget, marginTop: spacing.xxs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  remediationButtonText: { color: colors.navy, fontFamily: typography.bodyFamily, ...typography.roles.caption },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, borderRadius: radius.md, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyFamily, ...typography.roles.caption },
  voteRow: { flexDirection: 'row', gap: spacing.xs },
  voteButton: { flex: 1, minHeight: interaction.minimumTouchTarget, backgroundColor: colors.navy, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxs },
  voteButtonText: { color: colors.white, fontFamily: typography.bodyFamily, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.35 },
  disabledBusy: { opacity: interaction.disabledOpacity },
  error: { color: colors.errorText, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, padding: spacing.sm, fontFamily: typography.bodyFamily },
  empty: { textAlign: 'center', color: colors.textTertiary, fontFamily: typography.bodyFamily, paddingVertical: spacing.xxl },
  pressed: { opacity: interaction.pressedOpacity },
})

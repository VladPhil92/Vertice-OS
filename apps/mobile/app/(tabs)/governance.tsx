import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
import {
  mobileEligibilityExperience,
  type GovernanceEligibility,
} from '../../lib/governance-eligibility'
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
      Alert.alert('Voto bloqueado', 'Vértice no pudo certificar tu elegibilidad server-side para esta votación.')
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>GOBERNANZA CÍVICA · PHASE 7G.3</Text>
          <Text style={styles.title}>Propuestas y decisiones</Text>
          <Text style={styles.subtitle}>
            La app consulta al servidor si perteneces al electorado de cada votación. Un perfil, GPS, reputación o pago nunca habilita un voto por sí solo.
          </Text>
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
                    <Text style={styles.tallyTitle}>Tally verificable · {tally.total_votes} participantes</Text>
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
                          style={styles.remediationButton}
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
                  <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void endorse(proposal)}>
                    <Text style={styles.secondaryButtonText}>{busy ? 'Procesando…' : 'Avalar propuesta'}</Text>
                  </Pressable>
                ) : null}

                {proposal.status === 'voting' ? (
                  <View style={styles.voteRow}>
                    <Pressable disabled={busy || !canVote} style={[styles.voteButton, !canVote && styles.disabled]} onPress={() => void vote(proposal, 1)}>
                      <Text style={styles.voteButtonText}>A favor</Text>
                    </Pressable>
                    <Pressable disabled={busy || !canVote} style={[styles.voteButton, !canVote && styles.disabled]} onPress={() => void vote(proposal, -1)}>
                      <Text style={styles.voteButtonText}>En contra</Text>
                    </Pressable>
                    <Pressable disabled={busy || !canVote} style={[styles.voteButton, !canVote && styles.disabled]} onPress={() => void vote(proposal, 0)}>
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
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 36, gap: 18 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: '#697068' },
  title: { fontSize: 28, fontWeight: '700', color: '#11130F' },
  subtitle: { color: '#6D7168', lineHeight: 20 },
  list: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1, color: '#1C3D2E', fontWeight: '800' },
  scope: { textTransform: 'uppercase', fontSize: 10, color: '#6D7168', fontWeight: '700' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#171A15' },
  category: { textTransform: 'capitalize', color: '#70746C', fontSize: 12 },
  metaRow: { flexDirection: 'row', gap: 14 },
  meta: { color: '#596057', fontSize: 12 },
  tallyBox: { backgroundColor: '#E7E4D8', padding: 12, borderRadius: 12, gap: 4 },
  tallyTitle: { fontWeight: '700', color: '#252A24', fontSize: 12 },
  tallyLine: { color: '#555B53', fontSize: 12 },
  eligibilityBox: { borderRadius: 13, borderWidth: 1, padding: 13, gap: 5 },
  eligibilityPositive: { backgroundColor: '#E4EFE8', borderColor: '#BDD3C4' },
  eligibilityWarning: { backgroundColor: '#FFF5D9', borderColor: '#E4C975' },
  eligibilityBlocked: { backgroundColor: '#FBE9E7', borderColor: '#E1B4AE' },
  eligibilityTitle: { color: '#1E241E', fontWeight: '800', fontSize: 13 },
  eligibilityBody: { color: '#586058', fontSize: 12, lineHeight: 18 },
  eligibilityMeta: { color: '#72776E', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  remediationButton: { alignSelf: 'flex-start', marginTop: 5, borderRadius: 10, borderWidth: 1, borderColor: '#AEB8B0', paddingHorizontal: 11, paddingVertical: 8 },
  remediationButtonText: { color: '#17382A', fontWeight: '800', fontSize: 11 },
  secondaryButton: { borderWidth: 1, borderColor: '#BFC7C0', borderRadius: 12, padding: 11, alignItems: 'center' },
  secondaryButtonText: { color: '#1C3D2E', fontWeight: '700' },
  voteRow: { flexDirection: 'row', gap: 7 },
  voteButton: { flex: 1, backgroundColor: '#17382A', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  voteButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
})

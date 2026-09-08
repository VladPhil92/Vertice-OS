import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
import type { ApiList, GovernanceProposal, VoteTally } from '../../types/api'

type VoteValue = 'approve' | 'reject' | 'abstain'

export default function GovernanceScreen() {
  const [proposals, setProposals] = useState<GovernanceProposal[]>([])
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ApiList<GovernanceProposal>>('/governance/proposals?limit=30', { public: true })
      setProposals(response.data)

      const voting = response.data.filter((proposal) => proposal.status === 'voting')
      const results = await Promise.allSettled(
        voting.map(async (proposal) => [proposal.id, await apiFetch<VoteTally>(`/governance/proposals/${proposal.id}/tally`, { public: true })] as const),
      )
      const nextTallies: Record<string, VoteTally> = {}
      for (const result of results) {
        if (result.status === 'fulfilled') nextTallies[result.value[0]] = result.value[1]
      }
      setTallies(nextTallies)
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
      await apiMutation(`/governance/proposals/${proposal.id}/endorse`, `mobile-endorse-${proposal.id}`, { method: 'POST', body: '{}' })
      setProposals((current) => current.map((item) => item.id === proposal.id ? { ...item, endorsement_count: item.endorsement_count + 1 } : item))
    } catch (cause) {
      Alert.alert('No se pudo registrar el aval', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
    } finally {
      setBusyId(null)
    }
  }

  async function vote(proposal: GovernanceProposal, voteValue: VoteValue) {
    setBusyId(proposal.id)
    try {
      await apiMutation(`/governance/proposals/${proposal.id}/vote`, `mobile-vote-${proposal.id}`, {
        method: 'POST',
        body: JSON.stringify({ vote_value: voteValue }),
      })
      const tally = await apiFetch<VoteTally>(`/governance/proposals/${proposal.id}/tally`, { public: true })
      setTallies((current) => ({ ...current, [proposal.id]: tally }))
      Alert.alert('Participación registrada', 'Tu voto fue procesado por el ledger de gobernanza.')
    } catch (cause) {
      Alert.alert('No se pudo registrar el voto', cause instanceof Error ? cause.message : 'Verifica tu elegibilidad e intenta nuevamente.')
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
          <Text style={styles.eyebrow}>GOBERNANZA CÍVICA</Text>
          <Text style={styles.title}>Propuestas y decisiones</Text>
          <Text style={styles.subtitle}>Consulta iniciativas, avala propuestas y participa en votaciones cuando seas elegible.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.list}>
          {proposals.map((proposal) => {
            const tally = tallies[proposal.id]
            const busy = busyId === proposal.id
            return (
              <View key={proposal.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.status}>{proposal.status}</Text>
                  <Text style={styles.scope}>{proposal.scope}</Text>
                </View>
                <Text style={styles.cardTitle}>{proposal.title}</Text>
                <Text style={styles.category}>{proposal.category.replace(/_/g, ' ')}</Text>
                <Text style={styles.body}>{proposal.executive_summary?.trim() || proposal.description}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{proposal.endorsement_count} avales</Text>
                  <Text style={styles.meta}>{proposal.comment_count} comentarios</Text>
                </View>

                {tally ? (
                  <View style={styles.tallyBox}>
                    <Text style={styles.tallyTitle}>Tally verificable · {tally.total_votes} participantes</Text>
                    <Text style={styles.tallyLine}>A favor {tally.approve_weighted} · En contra {tally.reject_weighted} · Abstención {tally.abstain_weighted}</Text>
                    <Text style={styles.tallyLine}>Aprobación {tally.approval_percentage}% · Quórum {tally.quorum_met ? 'cumplido' : 'pendiente'}</Text>
                  </View>
                ) : null}

                <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void endorse(proposal)}>
                  <Text style={styles.secondaryButtonText}>{busy ? 'Procesando…' : 'Avalar propuesta'}</Text>
                </Pressable>

                {proposal.status === 'voting' ? (
                  <View style={styles.voteRow}>
                    <Pressable disabled={busy} style={styles.voteButton} onPress={() => void vote(proposal, 'approve')}>
                      <Text style={styles.voteButtonText}>A favor</Text>
                    </Pressable>
                    <Pressable disabled={busy} style={styles.voteButton} onPress={() => void vote(proposal, 'reject')}>
                      <Text style={styles.voteButtonText}>En contra</Text>
                    </Pressable>
                    <Pressable disabled={busy} style={styles.voteButton} onPress={() => void vote(proposal, 'abstain')}>
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
  body: { color: '#343931', lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 14 },
  meta: { color: '#596057', fontSize: 12 },
  tallyBox: { backgroundColor: '#E7E4D8', padding: 12, borderRadius: 12, gap: 4 },
  tallyTitle: { fontWeight: '700', color: '#252A24', fontSize: 12 },
  tallyLine: { color: '#555B53', fontSize: 12 },
  secondaryButton: { borderWidth: 1, borderColor: '#BFC7C0', borderRadius: 12, padding: 11, alignItems: 'center' },
  secondaryButtonText: { color: '#1C3D2E', fontWeight: '700' },
  voteRow: { flexDirection: 'row', gap: 7 },
  voteButton: { flex: 1, backgroundColor: '#17382A', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  voteButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { textAlign: 'center', color: '#777B74', paddingVertical: 28 },
})

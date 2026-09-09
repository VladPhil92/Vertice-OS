import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '../../lib/api'
import type {
  CivicIdentityAssurance,
  CivicIdentityProofingResponse,
  IdentityProviderAvailability,
  IdentityProviderSession,
} from '../../types/domain-parity'

function Requirement({ label, met }: { label: string; met: boolean }) {
  return (
    <View style={styles.requirement}>
      <Text style={[styles.requirementMark, met && styles.requirementMarkMet]}>{met ? '✓' : '○'}</Text>
      <Text style={styles.requirementLabel}>{label}</Text>
    </View>
  )
}

export default function IdentityAssuranceScreen() {
  const [assurance, setAssurance] = useState<CivicIdentityAssurance | null>(null)
  const [proofing, setProofing] = useState<CivicIdentityProofingResponse>({ proofs: [] })
  const [availability, setAvailability] = useState<IdentityProviderAvailability>({ providers: [] })
  const [refreshing, setRefreshing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextAssurance, nextProofing, nextAvailability] = await Promise.all([
        apiFetch<CivicIdentityAssurance>('/identity/assurance'),
        apiFetch<CivicIdentityProofingResponse>('/identity/proofing'),
        apiFetch<IdentityProviderAvailability>('/identity/providers/availability'),
      ])
      setAssurance(nextAssurance)
      setProofing(nextProofing)
      setAvailability(nextAvailability)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el estado de identidad.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const veriffAvailable = useMemo(
    () => availability.providers.some((provider) => provider.provider === 'veriff' && provider.session_bootstrap_available),
    [availability],
  )

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function startVeriff() {
    setStarting(true)
    setError(null)
    try {
      const session = await apiFetch<IdentityProviderSession>('/identity/providers/veriff/session', { method: 'POST' })
      const url = new URL(session.url)
      if (url.protocol !== 'https:') throw new Error('El proveedor devolvió una URL no segura.')
      await Linking.openURL(url.toString())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar la verificación.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Volver</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>IDENTITY ASSURANCE</Text>
          <Text style={styles.title}>Identidad cívica</Text>
          <Text style={styles.intro}>Autenticarse, tener reputación o seleccionar territorio no equivale a identidad cívica asegurada. La elegibilidad se decide exclusivamente en backend.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.statusCard, assurance?.assured && styles.statusCardReady]}>
          <Text style={styles.statusKicker}>ESTADO</Text>
          <Text style={styles.statusValue}>{assurance?.assured ? 'Identidad asegurada' : 'Verificación requerida'}</Text>
          <Text style={styles.statusBody}>Gobernanza: {assurance?.governance_eligible ? 'elegible según estado actual' : 'no elegible todavía'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Requisitos independientes</Text>
          <Requirement label="Contacto verificado" met={assurance?.requirements.contact_verified ?? false} />
          <Requirement label="Ingreso del proveedor operativo" met={assurance?.requirements.provider_ingress_operational ?? false} />
          <Requirement label="Prueba de identidad activa" met={assurance?.requirements.active_identity_proof ?? false} />
          <Requirement label="Proveedor certificado externamente" met={assurance?.requirements.provider_external_certified ?? false} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proveedor de identidad</Text>
          <Text style={styles.body}>{veriffAvailable ? 'Veriff está disponible para iniciar una sesión segura.' : 'La creación de sesiones Veriff no está habilitada en este runtime.'}</Text>
          <Pressable
            disabled={!veriffAvailable || starting}
            onPress={() => void startVeriff()}
            style={[styles.primaryButton, (!veriffAvailable || starting) && styles.disabled]}
          >
            <Text style={styles.primaryButtonText}>{starting ? 'Iniciando…' : 'Iniciar verificación con Veriff'}</Text>
          </Pressable>
          <Text style={styles.boundary}>Abrir una sesión no certifica identidad por sí mismo. El resultado requiere webhook autenticado, proofing activo y certificación externa vigente.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial de proofing</Text>
          {proofing.proofs.map((proof) => (
            <View key={proof.id} style={styles.proofRow}>
              <View style={styles.proofCopy}>
                <Text style={styles.proofProvider}>{proof.provider}</Text>
                <Text style={styles.proofMeta}>Assurance {proof.assurance_level} · {proof.status}</Text>
              </View>
              <Text style={styles.proofDate}>{proof.verified_at ? new Date(proof.verified_at).toLocaleDateString() : '—'}</Text>
            </View>
          ))}
          {proofing.proofs.length === 0 ? <Text style={styles.empty}>Aún no hay pruebas de identidad registradas.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#B9BDB5' },
  backText: { color: '#17382A', fontWeight: '700' },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#697068' },
  title: { fontSize: 30, fontWeight: '800', color: '#11130F' },
  intro: { color: '#5E6259', lineHeight: 20 },
  statusCard: { borderRadius: 20, padding: 18, backgroundColor: '#6C3E2D', gap: 5 },
  statusCardReady: { backgroundColor: '#17382A' },
  statusKicker: { color: '#E7DED8', fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  statusValue: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  statusBody: { color: '#EFE9E5' },
  card: { borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171A15' },
  body: { color: '#5E6259', lineHeight: 19 },
  requirement: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  requirementMark: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#EEEAE3', color: '#7A5C52', fontWeight: '800' },
  requirementMarkMet: { backgroundColor: '#DDEAE2', color: '#17382A' },
  requirementLabel: { flex: 1, color: '#353A33' },
  primaryButton: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17382A' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  boundary: { color: '#777B74', fontSize: 11, lineHeight: 16 },
  proofRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#ECE9E1' },
  proofCopy: { flex: 1, gap: 3 },
  proofProvider: { color: '#171A15', fontWeight: '700', textTransform: 'capitalize' },
  proofMeta: { color: '#6D7168', fontSize: 12 },
  proofDate: { color: '#6D7168', fontSize: 12 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  empty: { color: '#777B74', textAlign: 'center', paddingVertical: 12 },
  disabled: { opacity: 0.45 },
})

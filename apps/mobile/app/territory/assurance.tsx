import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'

type EvidenceType = 'secure_document' | 'institutional_attestation' | 'provider_attestation'

interface MyTerritory {
  territory_code: string | null
  territory_name: string | null
  territory_level: string | null
  neighborhood: string | null
}

interface AssuranceRequest {
  id: string
  status: string
  evidence_type: EvidenceType
  submitted_at: string
  verified_at: string | null
  expires_at: string | null
}

interface AssuranceState {
  territory_code: string | null
  territory_name: string | null
  territory_level: string | null
  territory_assurance_level: number
  effective_territory_assurance_level: number
  territory_assurance_effective: boolean
  current_request_verified_at: string | null
  current_request_expires_at: string | null
  renewal_required: boolean
  pending_request: AssuranceRequest | null
  governance_effect: 'territorial_prerequisite_satisfied' | 'none_expired_residence' | 'none_without_verified_residence'
}

const EVIDENCE_OPTIONS: Array<{ value: EvidenceType; label: string }> = [
  { value: 'secure_document', label: 'Documento revisado en canal seguro' },
  { value: 'institutional_attestation', label: 'Constancia institucional' },
  { value: 'provider_attestation', label: 'Proveedor autorizado' },
]

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default function TerritoryAssuranceScreen() {
  const [home, setHome] = useState<MyTerritory | null>(null)
  const [assurance, setAssurance] = useState<AssuranceState | null>(null)
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('secure_document')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [territory, state] = await Promise.all([
        apiFetch<MyTerritory>('/territories/me'),
        apiFetch<AssuranceState>('/territories/assurance/me'),
      ])
      setHome(territory)
      setAssurance(state)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tu estado territorial.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const status = useMemo(() => {
    if (!assurance) return { label: 'Sin datos', body: 'No fue posible determinar el estado de residence assurance.', kind: 'neutral' as const }
    if (assurance.pending_request) return {
      label: 'En revisión',
      body: `Solicitud recibida el ${formatDate(assurance.pending_request.submitted_at)}. Aún no concede elegibilidad territorial.`,
      kind: 'warning' as const,
    }
    if (assurance.territory_assurance_effective && assurance.renewal_required) return {
      label: 'Verificada · renovación disponible',
      body: `Tu residencia sigue vigente hasta ${formatDate(assurance.current_request_expires_at)}, pero ya puedes renovarla.`,
      kind: 'warning' as const,
    }
    if (assurance.territory_assurance_effective) return {
      label: 'Residencia verificada',
      body: `Vigente hasta ${formatDate(assurance.current_request_expires_at)}. Puede satisfacer el requisito territorial de futuras votaciones compatibles.`,
      kind: 'positive' as const,
    }
    if (assurance.governance_effect === 'none_expired_residence') return {
      label: 'Verificación vencida',
      body: 'Ya no puede usarse para entrar a nuevos padrones subnacionales. Puedes renovarla para futuras votaciones.',
      kind: 'blocked' as const,
    }
    return {
      label: 'Residencia no verificada',
      body: 'Tu municipio principal es autodeclarado. No prueba residencia ni elegibilidad de gobernanza.',
      kind: 'neutral' as const,
    }
  }, [assurance])

  const canSubmit = Boolean(home?.territory_code)
    && !assurance?.pending_request
    && (!assurance?.territory_assurance_effective || assurance.renewal_required)

  async function submit() {
    const normalized = reference.trim()
    setError(null)
    setMessage(null)
    if (!home?.territory_code) {
      setError('Selecciona primero tu municipio o distrito principal.')
      return
    }
    if (normalized.length < 16) {
      setError('La referencia segura debe tener al menos 16 caracteres.')
      return
    }
    if (/^https?:\/\//i.test(normalized)) {
      setError('No pegues URLs. Usa únicamente la referencia opaca emitida por el canal seguro.')
      return
    }

    setSubmitting(true)
    try {
      const result = await apiMutation<{ reused: boolean; renewal: boolean; request: AssuranceRequest }>(
        '/territories/assurance/requests',
        'territory-assurance-request',
        {
          method: 'POST',
          body: JSON.stringify({ evidence_type: evidenceType, evidence_reference: normalized }),
        },
      )
      setReference('')
      setMessage(
        result.reused
          ? 'Ya existe una verificación o solicitud activa para este territorio.'
          : result.renewal
            ? 'Renovación enviada. La verificación actual mantiene su vigencia hasta que expire o sea reemplazada por una decisión válida.'
            : 'Solicitud enviada. No tendrá efecto de gobernanza hasta que sea verificada.',
      )
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible enviar la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  const statusStyle = status.kind === 'positive'
    ? styles.statusPositive
    : status.kind === 'warning'
      ? styles.statusWarning
      : status.kind === 'blocked'
        ? styles.statusBlocked
        : styles.statusNeutral

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PHASE 7G.3 · RESIDENCE ASSURANCE</Text>
          <Text style={styles.title}>Residencia y elegibilidad cívica</Text>
          <Text style={styles.heroBody}>
            Municipio principal, ubicación actual y residencia verificada son estados distintos. La app nunca decide por sí sola si puedes votar.
          </Text>
        </View>

        {loading ? <Text style={styles.muted}>Cargando estado…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        {!loading ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Territorio principal</Text>
              <Text style={styles.cardTitle}>{assurance?.territory_name ?? home?.territory_name ?? 'Sin seleccionar'}</Text>
              <Text style={styles.meta}>{home?.territory_code ?? 'Ningún municipio o distrito vinculado'}</Text>
              <Text style={styles.body}>
                Esta selección es autodeclarada. Cambiarla invalida la verificación residencial anterior, pero nunca reescribe un padrón electoral ya congelado.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/territory/select')} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cambiar territorio principal</Text>
              </Pressable>
            </View>

            <View style={[styles.statusCard, statusStyle]}>
              <Text style={styles.statusLabel}>ESTADO DE RESIDENCIA</Text>
              <Text style={styles.statusTitle}>{status.label}</Text>
              <Text style={styles.statusBody}>{status.body}</Text>
              {assurance?.territory_assurance_effective ? (
                <Text style={styles.statusMeta}>
                  Verificada {formatDate(assurance.current_request_verified_at)} · Expira {formatDate(assurance.current_request_expires_at)}
                </Text>
              ) : null}
              {assurance?.pending_request ? (
                <Text style={styles.statusMeta}>Solicitud {assurance.pending_request.id.slice(0, 8)}…</Text>
              ) : null}
            </View>

            {canSubmit ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{assurance?.renewal_required ? 'Renovar residencia' : 'Verificar residencia'}</Text>
                <Text style={styles.body}>
                  Selecciona la clase de evidencia y pega solo la referencia opaca emitida por un canal seguro. No pegues documentos, cédulas, direcciones, fotos ni enlaces.
                </Text>

                <Text style={styles.label}>Tipo de evidencia</Text>
                <View style={styles.optionList}>
                  {EVIDENCE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: evidenceType === option.value }}
                      onPress={() => setEvidenceType(option.value)}
                      style={[styles.option, evidenceType === option.value && styles.optionSelected]}
                    >
                      <Text style={[styles.optionText, evidenceType === option.value && styles.optionTextSelected]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Referencia segura</Text>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="vault:opaque/reference-token"
                  placeholderTextColor="#8A8E85"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={() => void submit()}
                  style={[styles.primaryButton, submitting && styles.disabled]}
                >
                  <Text style={styles.primaryButtonText}>{submitting ? 'Enviando…' : assurance?.renewal_required ? 'Enviar renovación' : 'Enviar verificación'}</Text>
                </Pressable>
              </View>
            ) : assurance?.territory_assurance_effective && !assurance.renewal_required ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Renovación todavía no necesaria</Text>
                <Text style={styles.body}>La renovación se habilitará durante los últimos 30 días de vigencia.</Text>
              </View>
            ) : null}

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryText}>
                <Text style={styles.boundaryStrong}>Límite de autoridad. </Text>
                GPS, contexto activo, reputación, seguidores, Free/Pro, pagos, donaciones y crowdfunding no prueban residencia ni conceden voto. Una vez abierta una votación, manda exclusivamente el padrón congelado.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 44, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#24573E', fontWeight: '700' },
  hero: { borderRadius: 24, padding: 22, backgroundColor: '#17382A', gap: 9 },
  eyebrow: { color: '#C8D9CF', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 29, lineHeight: 35, fontWeight: '800' },
  heroBody: { color: '#D9E4DD', lineHeight: 21 },
  card: { borderRadius: 22, padding: 18, backgroundColor: '#FFFFFF', gap: 12 },
  label: { color: '#697068', fontSize: 11, letterSpacing: 1.1, fontWeight: '800', textTransform: 'uppercase' },
  cardTitle: { color: '#171A15', fontSize: 20, fontWeight: '800' },
  body: { color: '#62685F', lineHeight: 20 },
  meta: { color: '#7B8078', fontSize: 12 },
  muted: { color: '#73786F', textAlign: 'center', paddingVertical: 20 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12, lineHeight: 19 },
  success: { color: '#24573E', backgroundColor: '#E4EFE8', borderRadius: 12, padding: 12, lineHeight: 19 },
  statusCard: { borderRadius: 22, padding: 18, borderWidth: 1, gap: 7 },
  statusPositive: { backgroundColor: '#E4EFE8', borderColor: '#BDD3C4' },
  statusWarning: { backgroundColor: '#FFF5D9', borderColor: '#E4C975' },
  statusBlocked: { backgroundColor: '#FBE9E7', borderColor: '#E1B4AE' },
  statusNeutral: { backgroundColor: '#EEECE4', borderColor: '#DCD8CD' },
  statusLabel: { color: '#697068', fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
  statusTitle: { color: '#1E241E', fontSize: 18, fontWeight: '800' },
  statusBody: { color: '#586058', lineHeight: 20 },
  statusMeta: { color: '#697068', fontSize: 12, marginTop: 3 },
  optionList: { gap: 8 },
  option: { borderWidth: 1, borderColor: '#D6D3CA', borderRadius: 12, padding: 12, backgroundColor: '#FAF9F5' },
  optionSelected: { borderColor: '#17382A', backgroundColor: '#E6EEE8' },
  optionText: { color: '#62685F', fontSize: 13 },
  optionTextSelected: { color: '#17382A', fontWeight: '800' },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#D6D3CA', backgroundColor: '#FAF9F5', paddingHorizontal: 13, color: '#20251F' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#17382A' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#BFC7C0' },
  secondaryButtonText: { color: '#17382A', fontWeight: '800' },
  boundaryCard: { borderRadius: 18, padding: 17, backgroundColor: '#E7EFE9' },
  boundaryText: { color: '#3E5547', lineHeight: 21 },
  boundaryStrong: { fontWeight: '800' },
  disabled: { opacity: 0.5 },
})

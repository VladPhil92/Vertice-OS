import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch, apiMutation } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'

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

  const statusIconColor = status.kind === 'positive'
    ? colors.successText
    : status.kind === 'warning'
      ? colors.warningText
      : status.kind === 'blocked'
        ? colors.errorText
        : colors.textTertiary

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="verified" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>RESIDENCIA</Text>
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
            <VerticeIcon name="verified" color={colors.white} size={24} />
          </View>
          <Text style={styles.eyebrow}>PHASE 7G.3 · RESIDENCE ASSURANCE</Text>
          <Text style={styles.title}>Residencia y elegibilidad cívica</Text>
          <Text style={styles.heroBody}>
            Municipio principal, ubicación actual y residencia verificada son estados distintos. La app nunca decide por sí sola si puedes votar.
          </Text>
        </View>

        {loading ? <Text style={styles.muted}>Cargando estado…</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          </View>
        ) : null}
        {message ? (
          <View style={styles.successCard}>
            <Text style={styles.success}>{message}</Text>
          </View>
        ) : null}

        {!loading ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>TERRITORIO PRINCIPAL</Text>
              <View style={styles.territoryHeading}>
                <View style={styles.territoryIcon}>
                  <VerticeIcon name="territory" color={colors.navy} size={22} />
                </View>
                <View style={styles.territoryCopy}>
                  <Text style={styles.cardTitle}>{assurance?.territory_name ?? home?.territory_name ?? 'Sin seleccionar'}</Text>
                  <Text style={styles.meta}>{home?.territory_code ?? 'Ningún municipio o distrito vinculado'}</Text>
                </View>
              </View>
              <Text style={styles.body}>
                Esta selección es autodeclarada. Cambiarla invalida la verificación residencial anterior, pero nunca reescribe un padrón electoral ya congelado.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/territory/select')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <VerticeIcon name="territory" color={colors.navy} size={18} />
                <Text style={styles.secondaryButtonText}>Cambiar territorio principal</Text>
              </Pressable>
            </View>

            <View style={[styles.statusCard, statusStyle]}>
              <View style={styles.statusHeader}>
                <View style={styles.statusIcon}>
                  <VerticeIcon name={assurance?.territory_assurance_effective ? 'verified' : 'circle'} color={statusIconColor} size={24} />
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusLabel}>ESTADO DE RESIDENCIA</Text>
                  <Text style={styles.statusTitle}>{status.label}</Text>
                </View>
              </View>
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
                <Text style={styles.sectionKicker}>ASSURANCE TERRITORIAL</Text>
                <Text style={styles.cardTitle}>{assurance?.renewal_required ? 'Renovar residencia' : 'Verificar residencia'}</Text>
                <Text style={styles.body}>
                  Selecciona la clase de evidencia y pega solo la referencia opaca emitida por un canal seguro. No pegues documentos, cédulas, direcciones, fotos ni enlaces.
                </Text>

                <Text style={styles.label}>TIPO DE EVIDENCIA</Text>
                <View style={styles.optionList}>
                  {EVIDENCE_OPTIONS.map((option) => {
                    const selected = evidenceType === option.value
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => setEvidenceType(option.value)}
                        style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                      >
                        <VerticeIcon name={selected ? 'checkCircle' : 'circle'} color={selected ? colors.navy : colors.textTertiary} size={18} />
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>

                <Text style={styles.label}>REFERENCIA SEGURA</Text>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="vault:opaque/reference-token"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: submitting }}
                  disabled={submitting}
                  onPress={() => void submit()}
                  style={({ pressed }) => [styles.primaryButton, submitting && styles.disabled, pressed && !submitting && styles.pressed]}
                >
                  <VerticeIcon name="verified" color={colors.white} size={18} />
                  <Text style={styles.primaryButtonText}>{submitting ? 'Enviando…' : assurance?.renewal_required ? 'Enviar renovación' : 'Enviar verificación'}</Text>
                </Pressable>
              </View>
            ) : assurance?.territory_assurance_effective && !assurance.renewal_required ? (
              <View style={styles.card}>
                <Text style={styles.sectionKicker}>VIGENCIA</Text>
                <Text style={styles.cardTitle}>Renovación todavía no necesaria</Text>
                <Text style={styles.body}>La renovación se habilitará durante los últimos 30 días de vigencia.</Text>
              </View>
            ) : null}

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryKicker}>LÍMITE DE AUTORIDAD</Text>
              <Text style={styles.boundaryText}>
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  muted: { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.md, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, padding: spacing.sm },
  error: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  successCard: { borderRadius: radius.md, backgroundColor: colors.successBackground, borderWidth: 1, borderColor: colors.successBorder, padding: spacing.sm },
  success: { color: colors.successText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  label: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  meta: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  territoryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  territoryIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoBackground },
  territoryCopy: { flex: 1, gap: spacing.xxs },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  statusCard: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, gap: spacing.sm },
  statusPositive: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  statusWarning: { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder },
  statusBlocked: { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder },
  statusNeutral: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1, gap: spacing.xxs },
  statusLabel: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  statusTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 19, lineHeight: 24, fontWeight: '700' },
  statusBody: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  statusMeta: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  optionList: { gap: spacing.xs },
  option: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceAlt },
  optionSelected: { borderColor: colors.navy, backgroundColor: colors.infoBackground },
  optionText: { flex: 1, color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  optionTextSelected: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, fontWeight: '800' },
  input: { minHeight: interaction.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.textPrimary, fontFamily: typography.monoFamily, fontSize: 13 },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.white, textAlign: 'center', fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  boundaryCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, gap: spacing.xs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

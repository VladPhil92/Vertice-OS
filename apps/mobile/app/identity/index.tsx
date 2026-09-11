import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type {
  CivicIdentityAssurance,
  CivicIdentityProofingResponse,
  IdentityProviderAvailability,
  IdentityProviderSession,
} from '../../types/domain-parity'

function Requirement({ label, met }: { label: string; met: boolean }) {
  return (
    <View style={styles.requirement}>
      <View style={[styles.requirementMark, met && styles.requirementMarkMet]}>
        <VerticeIcon
          name={met ? 'checkCircle' : 'circle'}
          color={met ? colors.successText : colors.textTertiary}
          size={18}
        />
      </View>
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
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.identityBadge}>
            <VerticeIcon name="verified" color={colors.navy} size={16} />
            <Text style={styles.identityBadgeText}>IDENTIDAD</Text>
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

        <View style={styles.header}>
          <Text style={styles.eyebrow}>IDENTITY ASSURANCE</Text>
          <Text style={styles.title}>Identidad cívica</Text>
          <Text style={styles.intro}>
            Autenticarse, tener reputación o seleccionar territorio no equivale a identidad cívica asegurada. La elegibilidad se decide exclusivamente en backend.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.statusCard, assurance?.assured && styles.statusCardReady]}>
          <View style={styles.statusIcon}>
            <VerticeIcon
              name={assurance?.assured ? 'verified' : 'circle'}
              color={assurance?.assured ? colors.successText : colors.warningText}
              size={24}
            />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusKicker, assurance?.assured && styles.statusKickerReady]}>ESTADO</Text>
            <Text style={[styles.statusValue, assurance?.assured && styles.statusValueReady]}>
              {assurance?.assured ? 'Identidad asegurada' : 'Verificación requerida'}
            </Text>
            <Text style={[styles.statusBody, assurance?.assured && styles.statusBodyReady]}>
              Gobernanza: {assurance?.governance_eligible ? 'elegible según estado actual' : 'no elegible todavía'}
            </Text>
          </View>
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
          <Text style={styles.body}>
            {veriffAvailable
              ? 'Veriff está disponible para iniciar una sesión segura.'
              : 'La creación de sesiones Veriff no está habilitada en este runtime.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !veriffAvailable || starting }}
            disabled={!veriffAvailable || starting}
            onPress={() => void startVeriff()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!veriffAvailable || starting) && styles.disabled,
              pressed && veriffAvailable && !starting && styles.pressed,
            ]}
          >
            <VerticeIcon name="verified" color={colors.white} size={18} />
            <Text style={styles.primaryButtonText}>{starting ? 'Iniciando…' : 'Iniciar verificación con Veriff'}</Text>
          </Pressable>
          <View style={styles.boundaryCard}>
            <Text style={styles.boundary}>
              Abrir una sesión no certifica identidad por sí mismo. El resultado requiere webhook autenticado, proofing activo y certificación externa vigente.
            </Text>
          </View>
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identityBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  identityBadgeText: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, ...typography.roles.caption },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.textTertiary, ...typography.roles.label },
  title: { color: colors.textPrimary, ...typography.roles.hero },
  intro: { color: colors.textSecondary, ...typography.roles.body },
  statusCard: { flexDirection: 'row', borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder, gap: spacing.sm },
  statusCardReady: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  statusIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1, gap: spacing.xxs },
  statusKicker: { color: colors.warningText, ...typography.roles.label },
  statusKickerReady: { color: colors.successText },
  statusValue: { color: colors.warningText, fontFamily: typography.displayExtraBoldFamily, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  statusValueReady: { color: colors.successText },
  statusBody: { color: colors.warningText, ...typography.roles.body },
  statusBodyReady: { color: colors.successText },
  card: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...elevation.card },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { color: colors.textSecondary, ...typography.roles.body },
  requirement: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  requirementMark: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  requirementMarkMet: { backgroundColor: colors.successBackground },
  requirementLabel: { flex: 1, color: colors.textSecondary, ...typography.roles.body },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', gap: spacing.xs, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.white, ...typography.roles.button },
  boundaryCard: { borderRadius: radius.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, padding: spacing.sm },
  boundary: { color: colors.infoText, ...typography.roles.caption },
  proofRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  proofCopy: { flex: 1, gap: spacing.xxs },
  proofProvider: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontWeight: '700', textTransform: 'capitalize' },
  proofMeta: { color: colors.textTertiary, ...typography.roles.caption },
  proofDate: { color: colors.textTertiary, ...typography.roles.caption },
  errorCard: { borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, backgroundColor: colors.errorBackground, padding: spacing.sm },
  error: { color: colors.errorText, ...typography.roles.caption },
  empty: { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.sm, ...typography.roles.body },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

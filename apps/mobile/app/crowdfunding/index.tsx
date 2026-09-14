import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon, type VerticeIconName } from '../../components/VerticeIcon'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type {
  CrowdfundingCampaignReadiness,
  CrowdfundingReadiness,
  OwnCampaignsResponse,
  ReadinessBlocker,
  ReadinessState,
} from '../../types/domain-parity'

const READINESS_LABELS: Record<ReadinessState | string, string> = {
  ready: 'Listo',
  action_required: 'Acción requerida',
  pending_review: 'En revisión',
  platform_blocked: 'Bloqueo de plataforma',
  blocked: 'Bloqueado',
  verified: 'Verificado',
  disabled: 'Deshabilitado',
  misconfigured: 'Configuración pendiente',
  pending: 'Pendiente',
}

const SCOPE_LABELS: Record<ReadinessBlocker['scope'], string> = {
  user: 'USUARIO',
  campaign: 'CAMPAÑA',
  platform: 'PLATAFORMA',
}

function cop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin timestamp'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function stateIcon(value: string): VerticeIconName {
  if (value === 'ready' || value === 'verified') return 'checkCircle'
  if (value === 'pending_review' || value === 'pending') return 'pending'
  if (value === 'blocked' || value === 'platform_blocked' || value === 'disabled' || value === 'misconfigured') return 'block'
  return 'required'
}

function StatePill({ label, value }: { label: string; value: string }) {
  const ready = value === 'ready' || value === 'verified'
  const pending = value === 'pending_review' || value === 'pending'
  const blocked = value === 'blocked' || value === 'platform_blocked' || value === 'disabled' || value === 'misconfigured'
  const iconColor = ready
    ? colors.successText
    : pending
      ? colors.infoText
      : blocked
        ? colors.errorText
        : colors.warningText

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${READINESS_LABELS[value] ?? value}`}
      style={[
        styles.statePill,
        ready && styles.statePillReady,
        pending && styles.statePillPending,
        blocked && styles.statePillBlocked,
      ]}
    >
      <View style={styles.stateLabelRow}>
        <VerticeIcon name={stateIcon(value)} color={iconColor} size={16} />
        <Text style={styles.stateLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.stateValue,
          ready && styles.stateValueReady,
          pending && styles.stateValuePending,
          blocked && styles.stateValueBlocked,
        ]}
      >
        {READINESS_LABELS[value] ?? value}
      </Text>
    </View>
  )
}

function BlockerRow({ blocker }: { blocker: ReadinessBlocker }) {
  const platform = blocker.scope === 'platform'
  const campaign = blocker.scope === 'campaign'

  return (
    <View style={styles.blockerRow}>
      <View style={[styles.scopePill, platform && styles.scopePillPlatform, campaign && styles.scopePillCampaign]}>
        <Text style={[styles.blockerScope, platform && styles.blockerScopePlatform, campaign && styles.blockerScopeCampaign]}>
          {SCOPE_LABELS[blocker.scope]}
        </Text>
      </View>
      <View style={styles.blockerCopy}>
        <Text style={styles.blockerMessage}>{blocker.message}</Text>
        <Text selectable style={styles.blockerCode}>{blocker.code}</Text>
      </View>
    </View>
  )
}

function campaignSafetyState(campaign: CrowdfundingCampaignReadiness | undefined) {
  if (!campaign) return 'pending' as const
  if (campaign.can_accept_contributions) return 'ready' as const
  if (campaign.can_activate) return 'action_required' as const
  if (campaign.status === 'review' || campaign.compliance_status === 'in_review') return 'pending_review' as const
  if (campaign.status === 'suspended' || campaign.compliance_status === 'suspended' || campaign.compliance_status === 'rejected') return 'blocked' as const
  return 'action_required' as const
}

export default function CrowdfundingScreen() {
  const [readiness, setReadiness] = useState<CrowdfundingReadiness | null>(null)
  const [campaigns, setCampaigns] = useState<OwnCampaignsResponse['campaigns']>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextReadiness, nextCampaigns] = await Promise.all([
        apiFetch<CrowdfundingReadiness>('/crowdfunding/me/readiness'),
        apiFetch<OwnCampaignsResponse>('/crowdfunding/me/campaigns'),
      ])
      setReadiness(nextReadiness)
      setCampaigns(nextCampaigns.campaigns)
    } catch (cause) {
      setReadiness(null)
      setCampaigns([])
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar crowdfunding.')
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
            <VerticeIcon name="shield" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>FINANZAS SEGURAS</Text>
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
            <VerticeIcon name="community" color={colors.white} size={27} />
          </View>
          <Text style={styles.eyebrow}>RECAUDO COMUNITARIO</Text>
          <Text style={styles.title}>Crowdfunding</Text>
          <Text style={styles.heroBody}>
            Consulta preparación, campañas y bloqueos financieros sin convertir el estado local del dispositivo en autorización de recaudo o desembolso.
          </Text>
        </View>

        <View style={styles.authorityCard}>
          <VerticeIcon name="shield" color={colors.infoText} size={22} />
          <View style={styles.authorityCopy}>
            <Text style={styles.authorityKicker}>AUTORIDAD FINANCIERA</Text>
            <Text style={styles.authorityText}>
              El backend y sus proveedores certificados conservan la autoridad sobre activation, collection, settlement, refund y payout. Esta pantalla es de lectura y no ejecuta checkout ni desembolsos.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="signal" color={colors.azure} size={24} />
            <Text style={styles.stateText}>Consultando readiness financiero…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <VerticeIcon name="refresh" color={colors.navy} size={18} />
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {readiness ? (
          <>
            <View style={[styles.summaryCard, readiness.ready_for_campaign_activation ? styles.summaryReady : styles.summaryPending]}>
              <View style={styles.summaryHeader}>
                <VerticeIcon
                  name={readiness.ready_for_campaign_activation ? 'verified' : 'required'}
                  color={readiness.ready_for_campaign_activation ? colors.successText : colors.warningText}
                  size={24}
                />
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryKicker}>READINESS GENERAL DEL SERVIDOR</Text>
                  <Text style={styles.summaryValue}>
                    {readiness.ready_for_campaign_activation ? 'Elegible para activación' : 'Existen condiciones pendientes'}
                  </Text>
                </View>
              </View>
              <Text style={styles.summaryBody}>
                Usuario: {readiness.user_ready ? 'listo' : 'pendiente'} · Plataforma: {readiness.platform_ready ? 'lista' : 'bloqueada o pendiente'}
              </Text>
              <View style={styles.timestampRow}>
                <VerticeIcon name="timeline" color={colors.textTertiary} size={15} />
                <Text style={styles.timestampText}>Snapshot: {formatDate(readiness.generated_at)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <VerticeIcon name="signal" color={colors.navy} size={21} />
                <View style={styles.cardHeadingCopy}>
                  <Text style={styles.cardKicker}>CADENA DE PREPARACIÓN</Text>
                  <Text style={styles.cardTitle}>Persona y plataforma</Text>
                </View>
              </View>
              <StatePill label="Identidad" value={readiness.identity.state} />
              <StatePill label="Perfil de recaudo" value={readiness.payout_profile.state} />
              <StatePill label="Destino de desembolso" value={readiness.payout_destination.state} />
              <StatePill label="Federación CTG One" value={readiness.platform.ctg_one_federation} />
              <StatePill label="Proveedor de cobro" value={readiness.platform.collection_provider} />
              <StatePill label="Cobro crowdfunding" value={readiness.platform.crowdfunding_collection} />
              <StatePill label="Proveedor payout" value={readiness.platform.payout_provider} />
              <StatePill label="Ejecución payout" value={readiness.platform.payout_execution} />
              <StatePill label="Certificación payout" value={readiness.platform.payout_certification} />
              <Text style={styles.chainBoundary}>
                Un estado “Listo” describe el snapshot server-side; no equivale a settlement, transferencia bancaria ni payout ejecutado.
              </Text>
            </View>

            {readiness.blockers.length ? (
              <View style={styles.blockersCard}>
                <View style={styles.cardHeading}>
                  <VerticeIcon name="moderation" color={colors.warningText} size={21} />
                  <View style={styles.cardHeadingCopy}>
                    <Text style={styles.blockersKicker}>BLOQUEOS VIGENTES</Text>
                    <Text style={styles.cardTitle}>Qué impide avanzar</Text>
                  </View>
                </View>
                {readiness.blockers.map((blocker) => (
                  <BlockerRow key={`${blocker.scope}-${blocker.code}`} blocker={blocker} />
                ))}
                {readiness.blockers.some((item) => item.code === 'IDENTITY_VERIFICATION_REQUIRED') ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Revisar identidad cívica"
                    onPress={() => router.push('/identity')}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <VerticeIcon name="verified" color={colors.navy} size={18} />
                    <Text style={styles.secondaryButtonText}>Revisar identidad cívica</Text>
                    <VerticeIcon name="chevronRight" color={colors.navy} size={18} />
                  </Pressable>
                ) : null}
                {readiness.blockers.some((item) => item.action_href && item.code !== 'IDENTITY_VERIFICATION_REQUIRED') ? (
                  <Text style={styles.webActionHint}>
                    Algunas acciones operativas continúan disponibles únicamente en el dashboard web. Mobile no traduce rutas web en permisos financieros locales.
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.successCard}>
                <VerticeIcon name="checkCircle" color={colors.successText} size={21} />
                <Text style={styles.successText}>El snapshot no reporta bloqueos de readiness generales.</Text>
              </View>
            )}

            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}>
                <VerticeIcon name="case" color={colors.navy} size={20} />
              </View>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionKicker}>MIS CAMPAÑAS</Text>
                <Text style={styles.sectionTitle}>Estado financiero visible</Text>
              </View>
            </View>

            <View style={styles.campaignList}>
              {campaigns.map((campaign) => {
                const goal = Math.max(1, campaign.goal_amount_cop)
                const progress = Math.max(0, Math.min(100, Math.round((campaign.raised_amount_cop / goal) * 100)))
                const campaignReadiness = readiness.campaigns.find((item) => item.id === campaign.id)
                const financialState = campaignSafetyState(campaignReadiness)

                return (
                  <View
                    accessible
                    accessibilityLabel={`${campaign.title}. ${progress}% del objetivo registrado. Estado ${campaign.status}. Compliance ${campaign.compliance_status}.`}
                    key={campaign.id}
                    style={styles.campaignCard}
                  >
                    <View style={styles.campaignTop}>
                      <View style={styles.campaignTitleRow}>
                        <VerticeIcon name="case" color={colors.navy} size={18} />
                        <Text style={styles.campaignTitle}>{campaign.title}</Text>
                      </View>
                      <Text style={styles.progress}>{progress}%</Text>
                    </View>
                    <Text style={styles.campaignMeta}>{campaign.category} · {campaign.status} · compliance {campaign.compliance_status}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.amount}>{cop(campaign.raised_amount_cop)} de {cop(campaign.goal_amount_cop)}</Text>
                    <Text style={styles.amountBoundary}>Monto registrado por API; no constituye prueba local de settlement bancario.</Text>

                    <View style={styles.campaignStateGrid}>
                      <StatePill label="Lifecycle" value={campaignReadiness?.lifecycle_ready ? 'ready' : 'action_required'} />
                      <StatePill label="Activación" value={campaignReadiness?.can_activate ? 'ready' : financialState} />
                      <StatePill label="Recaudo" value={campaignReadiness?.can_accept_contributions ? 'ready' : financialState} />
                    </View>

                    {campaignReadiness?.review_notes ? (
                      <View style={styles.reviewNote}>
                        <Text style={styles.reviewNoteLabel}>NOTA DE REVISIÓN</Text>
                        <Text style={styles.reviewNoteText}>{campaignReadiness.review_notes}</Text>
                      </View>
                    ) : null}

                    {campaignReadiness?.blockers.length ? (
                      <View style={styles.campaignBlockers}>
                        {campaignReadiness.blockers.map((blocker) => (
                          <BlockerRow key={`${campaign.id}-${blocker.scope}-${blocker.code}`} blocker={blocker} />
                        ))}
                      </View>
                    ) : null}
                  </View>
                )
              })}

              {campaigns.length === 0 ? (
                <View style={styles.emptyCard}>
                  <VerticeIcon name="case" color={colors.textTertiary} size={26} />
                  <Text style={styles.empty}>Aún no tienes campañas creadas.</Text>
                  <Text style={styles.emptyHint}>Cuando el backend exponga campañas propias aparecerán aquí junto con su readiness.</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.boundaryCard}>
              <VerticeIcon name="shield" color={colors.infoText} size={22} />
              <View style={styles.boundaryCopy}>
                <Text style={styles.boundaryTitle}>Frontera financiera y cívica</Text>
                <Text style={styles.boundaryText}>
                  Pagos, donaciones, KYC/KYB, suscripciones, settlement y payouts no modifican reputación, ranking, voto ni autoridad cívica. Los feature flags, ledgers y proveedores del servidor siguen siendo la fuente de verdad.
                </Text>
              </View>
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
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.warningBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  authorityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  authorityCopy: { flex: 1, gap: spacing.xxs },
  authorityKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  authorityText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  stateCard: { minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateText: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, gap: spacing.sm },
  errorText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  retryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.errorBorder },
  retryText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  summaryCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, ...elevation.card },
  summaryReady: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  summaryPending: { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  summaryCopy: { flex: 1, gap: spacing.xxs },
  summaryKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  summaryValue: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  summaryBody: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  timestampText: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...elevation.card },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardHeadingCopy: { flex: 1, gap: spacing.xxs },
  cardKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  statePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder },
  statePillReady: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  statePillPending: { backgroundColor: colors.infoBackground, borderColor: colors.infoBorder },
  statePillBlocked: { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder },
  stateLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stateLabel: { flex: 1, color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  stateValue: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  stateValueReady: { color: colors.successText },
  stateValuePending: { color: colors.infoText },
  stateValueBlocked: { color: colors.errorText },
  chainBoundary: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  blockersCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder, gap: spacing.sm },
  blockersKicker: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  blockerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  scopePill: { width: 76, borderRadius: radius.pill, alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, backgroundColor: colors.warningBorder },
  scopePillPlatform: { backgroundColor: colors.errorBorder },
  scopePillCampaign: { backgroundColor: colors.infoBorder },
  blockerScope: { color: colors.warningText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  blockerScopePlatform: { color: colors.errorText },
  blockerScopeCampaign: { color: colors.infoText },
  blockerCopy: { flex: 1, gap: spacing.xxs },
  blockerMessage: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 13, lineHeight: 19 },
  blockerCode: { color: colors.textTertiary, fontFamily: typography.monoFamily, ...typography.roles.mono },
  secondaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.warningBorder, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  webActionHint: { color: colors.warningText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  successCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.successBackground, borderWidth: 1, borderColor: colors.successBorder },
  successText: { flex: 1, color: colors.successText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sectionHeadingCopy: { flex: 1, gap: spacing.xxs },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  campaignList: { gap: spacing.sm },
  campaignCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...elevation.card },
  campaignTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  campaignTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  campaignTitle: { flex: 1, color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  progress: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  campaignMeta: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: colors.navy },
  amount: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  amountBoundary: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  campaignStateGrid: { gap: spacing.xs },
  reviewNote: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, gap: spacing.xxs },
  reviewNoteLabel: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  reviewNoteText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  campaignBlockers: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm },
  emptyCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  empty: { color: colors.textPrimary, textAlign: 'center', fontFamily: typography.bodyBoldFamily, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  emptyHint: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  boundaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  boundaryCopy: { flex: 1, gap: spacing.xxs },
  boundaryTitle: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  pressed: { opacity: interaction.pressedOpacity },
})

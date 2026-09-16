import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert as RNAlert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { Alert as UiAlert } from '../../components/ui'
import { apiFetch, apiMutation } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { CrowdfundingCampaign, OwnCampaignsResponse } from '../../types/domain-parity'

// Campaign creation is real: it calls the same canonical /crowdfunding
// contract the web dashboard uses (see apps/web/app/dashboard/crowdfunding/
// new/page.tsx) and produces a real draft row, pending compliance review —
// exactly like web. What stays unavailable on mobile until the payment
// providers (Mercado Pago/Wompi) are certified is *collection*: activation,
// contributions and checkout. Those endpoints are never called here.
const COLLECTION_LAUNCH_MONTH = 'octubre de 2026'

type FundingModel = 'donation' | 'reward'
type FundingPolicy = 'flexible' | 'all_or_nothing' | 'milestone'

interface CategoryDefinition {
  id: string
  label: string
  description: string
  suggestedFundingPolicy: FundingPolicy
}

interface ConfigResponse {
  categoryCatalog: CategoryDefinition[]
  fundingModels: FundingModel[]
  fundingPolicies: FundingPolicy[]
  currency: 'COP'
}

interface CreatedCampaignResponse {
  campaign: { id: string; title: string; funding_policy: FundingPolicy }
  nextStep: 'compliance_review'
  activationRequiresReview: boolean
}

type BudgetRow = { id: string; label: string; amount: string }

const POLICY_LABEL: Record<FundingPolicy, string> = {
  flexible: 'Flexible',
  all_or_nothing: 'Todo o nada',
  milestone: 'Por hitos',
}

const MODEL_LABEL: Record<FundingModel, string> = {
  donation: 'Donación',
  reward: 'Recompensa / preventa',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  verified: 'Verificada',
  active: 'Activa',
  funded: 'Fondeada',
  executing: 'En ejecución',
  verifying: 'Verificando cierre',
  completed: 'Completada',
  suspended: 'Suspendida',
  investigation: 'En investigación',
}

function parseCop(value: string): number {
  const normalized = value.replace(/[^0-9]/g, '')
  return normalized ? Number(normalized) : 0
}

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function createBudgetRow(): BudgetRow {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: '', amount: '' }
}

const initialForm = { title: '', summary: '', description: '', goal: '', neighborhood: '' }

export default function CrowdfundingScreen() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [campaigns, setCampaigns] = useState<CrowdfundingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [category, setCategory] = useState('')
  const [fundingModel, setFundingModel] = useState<FundingModel>('donation')
  const [fundingPolicy, setFundingPolicy] = useState<FundingPolicy>('flexible')
  const [form, setForm] = useState(initialForm)
  const [budget, setBudget] = useState<BudgetRow[]>([createBudgetRow()])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [configResponse, ownCampaigns] = await Promise.all([
        apiFetch<ConfigResponse>('/crowdfunding/config'),
        apiFetch<OwnCampaignsResponse>('/crowdfunding/me/campaigns'),
      ])
      setConfig(configResponse)
      setCampaigns(ownCampaigns.campaigns)
      const first = configResponse.categoryCatalog[0]
      if (first) {
        setCategory((current) => current || first.id)
        setFundingPolicy((current) => (current === 'flexible' ? first.suggestedFundingPolicy : current))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el recaudo comunitario.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selectedCategory = config?.categoryCatalog.find((item) => item.id === category)
  const goalAmount = parseCop(form.goal)
  const budgetTotal = useMemo(() => budget.reduce((sum, item) => sum + parseCop(item.amount), 0), [budget])

  function selectCategory(next: CategoryDefinition) {
    setCategory(next.id)
    if (fundingModel === 'donation') setFundingPolicy(next.suggestedFundingPolicy)
  }

  function selectModel(next: FundingModel) {
    setFundingModel(next)
    if (next === 'reward' && fundingPolicy === 'flexible') setFundingPolicy('all_or_nothing')
    if (next === 'donation' && selectedCategory) setFundingPolicy(selectedCategory.suggestedFundingPolicy)
  }

  function updateBudget(id: string, field: 'label' | 'amount', value: string) {
    setBudget((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  function addBudgetRow() {
    if (budget.length >= 50) return
    setBudget((rows) => [...rows, createBudgetRow()])
  }

  function removeBudgetRow(id: string) {
    if (budget.length === 1) return
    setBudget((rows) => rows.filter((row) => row.id !== id))
  }

  function resetForm() {
    setForm(initialForm)
    setBudget([createBudgetRow()])
    const first = config?.categoryCatalog[0]
    if (first) {
      setCategory(first.id)
      setFundingPolicy(first.suggestedFundingPolicy)
    }
    setFundingModel('donation')
  }

  async function createCampaign() {
    if (!config || !category) {
      RNAlert.alert('Falta información', 'La configuración de categorías aún no está disponible.')
      return
    }
    if (form.title.trim().length < 8 || form.summary.trim().length < 20 || form.description.trim().length < 80) {
      RNAlert.alert('Información incompleta', 'Completa título (mín. 8), resumen (mín. 20) y descripción (mín. 80 caracteres).')
      return
    }
    if (goalAmount < 50_000 || goalAmount > 2_000_000_000) {
      RNAlert.alert('Meta inválida', 'La meta debe estar entre $50.000 y $2.000.000.000 COP.')
      return
    }
    if (budgetTotal > goalAmount) {
      RNAlert.alert('Presupuesto inválido', 'El presupuesto desglosado no puede superar la meta de recaudo.')
      return
    }
    const normalizedBudget = budget.map((row) => ({ label: row.label.trim(), amount_cop: parseCop(row.amount) }))
    if (normalizedBudget.some((row) => row.label.length < 3 || row.amount_cop <= 0)) {
      RNAlert.alert('Presupuesto incompleto', 'Cada partida necesita un concepto de al menos 3 caracteres y un valor mayor que cero.')
      return
    }

    setSubmitting(true)
    try {
      await apiMutation<CreatedCampaignResponse>('/crowdfunding/campaigns', 'mobile-crowdfunding-campaign', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          description: form.description.trim(),
          category,
          funding_model: fundingModel,
          funding_policy: fundingPolicy,
          goal_amount_cop: goalAmount,
          neighborhood: form.neighborhood.trim() || undefined,
          budget: normalizedBudget,
        }),
      })
      resetForm()
      setShowCreate(false)
      await load()
    } catch (cause) {
      RNAlert.alert('No se pudo guardar la campaña', cause instanceof Error ? cause.message : 'Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <VerticeIcon name="back" color={colors.navy} size={18} />
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <VerticeIcon name="community" color={colors.white} size={27} />
          </View>
          <Text style={styles.eyebrow}>RECAUDO COMUNITARIO</Text>
          <Text style={styles.title}>Crea tu campaña</Text>
          <Text style={styles.heroBody}>
            Puedes crear tu campaña hoy: queda guardada como borrador. Enviarla a revisión de cumplimiento y activarla para recibir aportes llega junto con los proveedores de pago en {COLLECTION_LAUNCH_MONTH}.
          </Text>
        </View>

        {error ? <UiAlert type="error" message={error} /> : null}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => setShowCreate((value) => !value)}
        >
          <VerticeIcon name="document" color={colors.white} size={16} />
          <Text style={styles.primaryButtonText}>{showCreate ? 'Cerrar formulario' : 'Nueva campaña'}</Text>
        </Pressable>

        {showCreate ? (
          <View style={styles.formCard}>
            <View style={styles.formAccent} />
            <Text style={styles.formKicker}>NUEVA CAMPAÑA</Text>
            <Text style={styles.cardTitle}>1. Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(config?.categoryCatalog ?? []).map((item) => (
                <Pressable key={item.id} onPress={() => selectCategory(item)} style={[styles.chip, category === item.id && styles.chipActive]}>
                  <Text style={[styles.chipText, category === item.id && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {selectedCategory ? <Text style={styles.hint}>{selectedCategory.description}</Text> : null}

            <Text style={styles.cardTitle}>2. Modelo y política</Text>
            <View style={styles.row}>
              {(['donation', 'reward'] as FundingModel[]).map((model) => (
                <Pressable key={model} onPress={() => selectModel(model)} style={[styles.optionCard, fundingModel === model && styles.optionCardActive]}>
                  <Text style={[styles.optionTitle, fundingModel === model && styles.optionTitleActive]}>{MODEL_LABEL[model]}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(config?.fundingPolicies ?? []).map((policy) => {
                const disabled = fundingModel === 'reward' && policy === 'flexible'
                return (
                  <Pressable key={policy} disabled={disabled} onPress={() => setFundingPolicy(policy)} style={[styles.chip, fundingPolicy === policy && styles.chipActive, disabled && styles.disabled]}>
                    <Text style={[styles.chipText, fundingPolicy === policy && styles.chipTextActive]}>{POLICY_LABEL[policy]}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <Text style={styles.cardTitle}>3. Información pública</Text>
            <TextInput
              style={styles.input}
              placeholder="Título (mín. 8 caracteres)"
              placeholderTextColor={colors.placeholder}
              maxLength={120}
              value={form.title}
              onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              placeholder="Resumen breve (mín. 20 caracteres)"
              placeholderTextColor={colors.placeholder}
              maxLength={280}
              value={form.summary}
              onChangeText={(summary) => setForm((prev) => ({ ...prev, summary }))}
            />
            <TextInput
              style={[styles.input, styles.multilineLarge]}
              multiline
              placeholder="Descripción y plan de ejecución (mín. 80 caracteres)"
              placeholderTextColor={colors.placeholder}
              maxLength={8000}
              value={form.description}
              onChangeText={(description) => setForm((prev) => ({ ...prev, description }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Meta de recaudo en COP (ej. 5000000)"
              placeholderTextColor={colors.placeholder}
              inputMode="numeric"
              value={form.goal}
              onChangeText={(goal) => setForm((prev) => ({ ...prev, goal }))}
            />
            {goalAmount > 0 ? <Text style={styles.hint}>{formatCop(goalAmount)}</Text> : null}
            <TextInput
              style={styles.input}
              placeholder="Barrio o territorio (opcional)"
              placeholderTextColor={colors.placeholder}
              maxLength={120}
              value={form.neighborhood}
              onChangeText={(neighborhood) => setForm((prev) => ({ ...prev, neighborhood }))}
            />

            <View style={styles.budgetHeader}>
              <Text style={styles.cardTitle}>4. Presupuesto desglosado</Text>
              <Pressable disabled={budget.length >= 50} onPress={addBudgetRow} style={[styles.smallButton, budget.length >= 50 && styles.disabled]}>
                <Text style={styles.smallButtonText}>Añadir partida</Text>
              </Pressable>
            </View>
            {budget.map((row, index) => (
              <View key={row.id} style={styles.budgetRow}>
                <TextInput
                  style={[styles.input, styles.budgetLabel]}
                  placeholder={`Concepto ${index + 1}`}
                  placeholderTextColor={colors.placeholder}
                  maxLength={120}
                  value={row.label}
                  onChangeText={(label) => updateBudget(row.id, 'label', label)}
                />
                <TextInput
                  style={[styles.input, styles.budgetAmount]}
                  placeholder="Valor COP"
                  placeholderTextColor={colors.placeholder}
                  inputMode="numeric"
                  value={row.amount}
                  onChangeText={(amount) => updateBudget(row.id, 'amount', amount)}
                />
                <Pressable disabled={budget.length === 1} onPress={() => removeBudgetRow(row.id)} style={[styles.removeButton, budget.length === 1 && styles.disabled]}>
                  <VerticeIcon name="delete" color={colors.errorText} size={16} />
                </Pressable>
              </View>
            ))}
            <View style={styles.budgetSummary}>
              <Text style={styles.hint}>Meta: {formatCop(goalAmount)}</Text>
              <Text style={[styles.hint, budgetTotal > goalAmount && goalAmount > 0 && styles.hintError]}>Presupuesto: {formatCop(budgetTotal)}</Text>
              <Text style={styles.hint}>Sin asignar: {formatCop(Math.max(0, goalAmount - budgetTotal))}</Text>
            </View>

            <UiAlert
              type="success"
              message="Al guardar declaras un propósito de recaudo, no una inversión. La campaña queda en borrador y deberá superar revisión de cumplimiento antes de recibir aportes. El monto recaudado no compra reputación ni alcance cívico."
            />

            <Pressable disabled={submitting} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, submitting && styles.disabled]} onPress={() => void createCampaign()}>
              <Text style={styles.submitButtonText}>{submitting ? 'Guardando…' : 'Guardar borrador'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tus campañas</Text>
          <View style={styles.list}>
            {campaigns.map((campaign) => (
              <View key={campaign.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.category}>{campaign.category.replace(/_/g, ' ')}</Text>
                  <Text style={styles.status}>{STATUS_LABEL[campaign.status] ?? campaign.status}</Text>
                </View>
                <Text style={styles.cardTitle}>{campaign.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{campaign.summary}</Text>
                <Text style={styles.muted}>Meta {formatCop(campaign.goal_amount_cop)} · {campaign.neighborhood ?? 'Sin territorio asignado'}</Text>
              </View>
            ))}
            {!loading && !error && campaigns.length === 0 ? <Text style={styles.empty}>Todavía no has creado ninguna campaña.</Text> : null}
          </View>
        </View>

        <View style={styles.boundaryCard}>
          <VerticeIcon name="info" color={colors.textTertiary} size={20} />
          <Text style={styles.boundaryText}>
            El recaudo, los pagos, KYC/KYB y los desembolsos nunca modifican tu reputación, ranking, voto ni autoridad cívica.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  formCard: { overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  formAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.citizen },
  formKicker: { marginTop: spacing.xxs, color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 15, fontWeight: '800', marginTop: spacing.xs },
  chips: { gap: spacing.xs, paddingVertical: spacing.xxs },
  chip: { borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.textSecondary, fontFamily: typography.bodyFamily, fontSize: 12 },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.xs },
  optionCard: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  optionCardActive: { borderColor: colors.azure, backgroundColor: colors.infoBackground },
  optionTitle: { color: colors.textPrimary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  optionTitleActive: { color: colors.navy, fontWeight: '800' },
  input: { minHeight: interaction.inputHeight, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.textPrimary, fontFamily: typography.bodyFamily },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  multilineLarge: { minHeight: 140, textAlignVertical: 'top' },
  hint: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12, lineHeight: 17 },
  hintError: { color: colors.errorText, fontWeight: '700' },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallButton: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.borderActive, borderRadius: radius.md, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  smallButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.caption },
  budgetRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  budgetLabel: { flex: 2 },
  budgetAmount: { flex: 1 },
  removeButton: { minHeight: interaction.minimumTouchTarget, minWidth: interaction.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.errorBackground },
  budgetSummary: { gap: spacing.xxs },
  submitButton: { minHeight: interaction.buttonHeight, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: colors.white, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayFamily, fontSize: 19, fontWeight: '800' },
  list: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, ...elevation.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  category: { textTransform: 'uppercase', color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  status: { textTransform: 'uppercase', color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, fontWeight: '800' },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 20 },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.textTertiary, fontFamily: typography.bodyFamily, paddingVertical: spacing.xl },
  boundaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  boundaryText: { flex: 1, color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

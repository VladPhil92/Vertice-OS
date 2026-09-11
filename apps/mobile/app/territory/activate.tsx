import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch, apiMutation } from '../../lib/api'
import { useAuth } from '../../providers/AuthProvider'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type {
  ApiList,
  MyTerritory,
  TerritoryActivationInterest,
  TerritoryInterestRole,
  TerritoryInterestStatus,
} from '../../types/api'

const ROLE_LABEL: Record<TerritoryInterestRole, string> = {
  ambassador: 'Embajador/a local',
  organizer: 'Organizador/a comunitario/a',
  observer: 'Observador/a territorial',
}

const ROLE_DESCRIPTION: Record<TerritoryInterestRole, string> = {
  ambassador: 'Ayudar a convocar y orientar a nuevas personas en el nodo local.',
  organizer: 'Apoyar la coordinación práctica de acciones, encuentros y seguimiento comunitario.',
  observer: 'Acompañar la lectura de actividad y señales territoriales sin asumir funciones operativas.',
}

const STATUS_LABEL: Record<TerritoryInterestStatus, string> = {
  pending: 'En revisión',
  approved: 'Interés aprobado',
  declined: 'No aprobado',
  withdrawn: 'Retirado',
}

function statusTone(status: TerritoryInterestStatus) {
  if (status === 'approved') return styles.statusApproved
  if (status === 'pending') return styles.statusPending
  if (status === 'declined') return styles.statusDeclined
  return styles.statusWithdrawn
}

export default function TerritoryActivationScreen() {
  const { user, loading: authLoading } = useAuth()
  const [territory, setTerritory] = useState<MyTerritory | null>(null)
  const [interests, setInterests] = useState<TerritoryActivationInterest[]>([])
  const [role, setRole] = useState<TerritoryInterestRole>('ambassador')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyInterestId, setBusyInterestId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const [current, currentInterests] = await Promise.all([
        apiFetch<MyTerritory>('/territories/me'),
        apiFetch<ApiList<TerritoryActivationInterest>>('/territories/activation/me/interests'),
      ])
      setTerritory(current)
      setInterests(currentInterests.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar tu activación territorial.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      router.replace({ pathname: '/(auth)/sign-in', params: { next: 'territory-activate' } })
      return
    }
    void load()
  }, [authLoading, user, load])

  const blockingInterestForSelectedRole = useMemo(
    () => interests.find(
      (interest) => interest.interest_role === role
        && (interest.status === 'pending' || interest.status === 'approved'),
    ),
    [interests, role],
  )

  async function refresh() {
    if (!user) return
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function submit() {
    if (!user || !territory?.territory_code || saving || blockingInterestForSelectedRole) return
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await apiMutation(
        `/territories/activation/${encodeURIComponent(territory.territory_code)}/interests`,
        'territory-activation-interest',
        {
          method: 'POST',
          body: JSON.stringify({ interest_role: role, message: message.trim() || null }),
        },
      )
      setMessage('')
      setNotice('Tu manifestación quedó registrada. Esto no crea un rol, permiso, reputación adicional ni autoridad de gobernanza.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar tu interés.')
    } finally {
      setSaving(false)
    }
  }

  async function withdraw(interest: TerritoryActivationInterest) {
    if (!user) return
    setBusyInterestId(interest.id)
    setNotice(null)
    setError(null)
    try {
      await apiMutation(
        `/territories/activation/${encodeURIComponent(interest.territory_code)}/interests/${interest.interest_role}`,
        'territory-activation-withdraw',
        { method: 'DELETE' },
      )
      setNotice('Manifestación retirada. El retiro no altera otros roles, reputación ni permisos de tu cuenta.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible retirar tu interés.')
    } finally {
      setBusyInterestId(null)
    }
  }

  if (authLoading || !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.authGate}>
          <VerticeBrand variant="symbol" width={48} />
          <Text style={styles.muted}>Verificando sesión ciudadana…</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
          <View style={styles.sectionBadge}>
            <VerticeIcon name="community" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>ACTIVACIÓN</Text>
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
            <VerticeIcon name="community" color={colors.white} size={24} />
          </View>
          <Text style={styles.eyebrow}>ACTIVACIÓN CIUDADANA · PHASE 7D</Text>
          <Text style={styles.title}>Ayuda a activar {territory?.territory_name ?? 'tu comunidad'}</Text>
          <Text style={styles.heroBody}>
            Puedes ofrecer apoyo local de manera voluntaria. La revisión de esta manifestación es operativa: no verifica residencia, no aumenta reputación y no concede autoridad de gobernanza.
          </Text>
          {territory?.territory_code ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/city/[code]', params: { code: territory.territory_code! } })}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
            >
              <VerticeIcon name="territory" color={colors.white} size={18} />
              <Text style={styles.outlineButtonText}>Ver nodo público de {territory.territory_name ?? 'mi ciudad'}</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? <Text style={styles.muted}>Cargando activación comunitaria…</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos completar la operación</Text>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {!loading && !territory?.territory_code ? (
          <View style={styles.card}>
            <Text style={styles.sectionKicker}>CONTEXTO TERRITORIAL</Text>
            <Text style={styles.sectionTitle}>Primero vincula tu territorio</Text>
            <Text style={styles.body}>Tu cuenta debe tener un municipio o distrito asociado antes de manifestar interés de activación.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/territory/select')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <VerticeIcon name="territory" color={colors.white} size={18} />
              <Text style={styles.primaryButtonText}>Seleccionar mi municipio o distrito</Text>
            </Pressable>
            <Text style={styles.helper}>La vinculación territorial continúa siendo autodeclarada y no equivale a residencia cívica verificada.</Text>
          </View>
        ) : null}

        {territory?.territory_code ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionKicker}>CÓMO QUIERES AYUDAR</Text>
              <Text style={styles.sectionTitle}>Participación local voluntaria</Text>
              <View style={styles.roleList}>
                {(Object.keys(ROLE_LABEL) as TerritoryInterestRole[]).map((value) => {
                  const selected = role === value
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setRole(value)}
                      style={({ pressed }) => [styles.roleCard, selected && styles.roleCardSelected, pressed && styles.pressed]}
                    >
                      <View style={[styles.roleMark, selected && styles.roleMarkSelected]}>
                        <VerticeIcon name={selected ? 'checkCircle' : 'circle'} color={selected ? colors.navy : colors.textTertiary} size={18} />
                      </View>
                      <View style={styles.roleCopy}>
                        <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{ROLE_LABEL[value]}</Text>
                        <Text style={styles.roleBody}>{ROLE_DESCRIPTION[value]}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.inputLabel}>MENSAJE OPCIONAL</Text>
              <TextInput
                multiline
                maxLength={500}
                value={message}
                onChangeText={setMessage}
                placeholder="Cuéntanos brevemente qué experiencia o disponibilidad puedes aportar."
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{message.length}/500</Text>

              {blockingInterestForSelectedRole ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>Ya tienes una manifestación activa para este tipo de participación: {STATUS_LABEL[blockingInterestForSelectedRole.status]}.</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: saving || Boolean(blockingInterestForSelectedRole) }}
                disabled={saving || Boolean(blockingInterestForSelectedRole)}
                onPress={() => void submit()}
                style={({ pressed }) => [styles.primaryButton, (saving || Boolean(blockingInterestForSelectedRole)) && styles.disabled, pressed && !saving && !blockingInterestForSelectedRole && styles.pressed]}
              >
                <VerticeIcon name="community" color={colors.white} size={18} />
                <Text style={styles.primaryButtonText}>{saving ? 'Registrando…' : 'Registrar mi interés'}</Text>
              </Pressable>
              <Text style={styles.helper}>
                Una aprobación no te añade automáticamente a una cohorte. Esa asignación es un proceso superadmin separado, explícito y auditable. Un interés no aprobado puede volver a manifestarse.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionKicker}>MIS MANIFESTACIONES</Text>
              <Text style={styles.sectionTitle}>Historial de activación</Text>
              {interests.length === 0 ? (
                <View style={styles.emptyCard}>
                  <VerticeIcon name="community" color={colors.textTertiary} size={24} />
                  <Text style={styles.empty}>Todavía no has registrado interés de activación territorial.</Text>
                </View>
              ) : (
                <View style={styles.interestList}>
                  {interests.map((interest) => (
                    <View key={interest.id} style={styles.interestCard}>
                      <View style={styles.interestHeader}>
                        <View style={styles.interestCopy}>
                          <Text style={styles.interestTitle}>{ROLE_LABEL[interest.interest_role]}</Text>
                          <Text style={styles.interestMeta}>{new Date(interest.updated_at).toLocaleDateString('es-CO')}</Text>
                        </View>
                        <View style={[styles.statusPill, statusTone(interest.status)]}>
                          <Text style={styles.statusText}>{STATUS_LABEL[interest.status]}</Text>
                        </View>
                      </View>
                      {interest.message ? <Text style={styles.interestMessage}>{interest.message}</Text> : null}
                      {interest.status !== 'withdrawn' ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: busyInterestId === interest.id }}
                          disabled={busyInterestId === interest.id}
                          onPress={() => void withdraw(interest)}
                          style={({ pressed }) => [styles.withdrawButton, busyInterestId === interest.id && styles.disabled, pressed && busyInterestId !== interest.id && styles.pressed]}
                        >
                          <Text style={styles.withdrawText}>{busyInterestId === interest.id ? 'Retirando…' : 'Retirar manifestación'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryKicker}>FRONTERA DE AUTORIDAD</Text>
              <Text style={styles.boundaryText}>
                Manifestar interés, ser aprobado o aparecer en una cola operativa no modifica autenticación, identity assurance, territory assurance, reputación, ranking, voto, autoridad cívica ni alcance orgánico.
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
  authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
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
  outlineButton: { marginTop: spacing.xs, minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderActive, paddingHorizontal: spacing.md },
  outlineButtonText: { flex: 1, color: colors.white, textAlign: 'center', fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  muted: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  errorCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder, gap: spacing.xxs },
  errorTitle: { color: colors.errorText, fontFamily: typography.displayBoldFamily, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  errorText: { color: colors.errorText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  noticeCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.successBackground, borderWidth: 1, borderColor: colors.successBorder },
  noticeText: { color: colors.successText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  roleList: { gap: spacing.sm },
  roleCard: { minHeight: 78, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  roleCardSelected: { borderColor: colors.navy, backgroundColor: colors.infoBackground },
  roleMark: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  roleMarkSelected: { backgroundColor: colors.citizen },
  roleCopy: { flex: 1, gap: spacing.xxs },
  roleTitle: { color: colors.textPrimary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  roleTitleSelected: { color: colors.navy },
  roleBody: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  inputLabel: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  input: { minHeight: 122, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt, padding: spacing.md, color: colors.textPrimary, fontFamily: typography.bodyFamily, fontSize: 15, lineHeight: 22 },
  counter: { alignSelf: 'flex-end', color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  infoCard: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warningBorder },
  infoText: { color: colors.warningText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', gap: spacing.xs, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.white, textAlign: 'center', fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  helper: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  emptyCard: { minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, padding: spacing.md },
  empty: { color: colors.textTertiary, textAlign: 'center', fontFamily: typography.bodyFamily, ...typography.roles.body },
  interestList: { gap: spacing.sm },
  interestCard: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  interestHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  interestCopy: { flex: 1, gap: spacing.xxs },
  interestTitle: { color: colors.textPrimary, fontFamily: typography.displayBoldFamily, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  interestMeta: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  statusApproved: { backgroundColor: colors.successBackground },
  statusPending: { backgroundColor: colors.warningBackground },
  statusDeclined: { backgroundColor: colors.errorBackground },
  statusWithdrawn: { backgroundColor: colors.surfaceAlt },
  statusText: { color: colors.textSecondary, fontFamily: typography.bodySemiboldFamily, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  withdrawButton: { minHeight: interaction.minimumTouchTarget, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorBackground, paddingHorizontal: spacing.sm },
  withdrawText: { color: colors.errorText, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  interestMessage: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  boundaryCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, gap: spacing.xs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  disabled: { opacity: interaction.disabledOpacity },
  pressed: { opacity: interaction.pressedOpacity },
})

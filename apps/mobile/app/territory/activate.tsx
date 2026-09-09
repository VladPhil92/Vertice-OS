import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch, apiMutation } from '../../lib/api'
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

export default function TerritoryActivationScreen() {
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
  }, [])

  useEffect(() => { void load() }, [load])

  const activeInterestForSelectedRole = useMemo(
    () => interests.find((interest) => interest.interest_role === role && interest.status !== 'withdrawn'),
    [interests, role],
  )

  async function refresh() {
    setRefreshing(true)
    try { await load() } finally { setRefreshing(false) }
  }

  async function submit() {
    if (!territory?.territory_code || saving || activeInterestForSelectedRole) return
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ACTIVACIÓN CIUDADANA · PHASE 7D</Text>
          <Text style={styles.title}>Ayuda a activar {territory?.territory_name ?? 'tu comunidad'}</Text>
          <Text style={styles.body}>
            Puedes ofrecer apoyo local de manera voluntaria. La revisión de esta manifestación es operativa: no verifica residencia, no aumenta reputación y no concede autoridad de gobernanza.
          </Text>
          {territory?.territory_code ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/city/${encodeURIComponent(territory.territory_code)}`)}
              style={styles.outlineButton}
            >
              <Text style={styles.outlineButtonText}>Ver nodo público de {territory.territory_name ?? 'mi ciudad'}</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? <Text style={styles.muted}>Cargando activación comunitaria…</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos completar la operación</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {!loading && !territory?.territory_code ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Primero vincula tu territorio</Text>
            <Text style={styles.body}>Tu cuenta debe tener un municipio o distrito asociado antes de manifestar interés de activación.</Text>
            <Text style={styles.boundaryText}>La vinculación territorial continúa siendo autodeclarada y no equivale a residencia cívica verificada.</Text>
          </View>
        ) : null}

        {territory?.territory_code ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionKicker}>CÓMO QUIERES AYUDAR</Text>
              <View style={styles.roleList}>
                {(Object.keys(ROLE_LABEL) as TerritoryInterestRole[]).map((value) => {
                  const selected = role === value
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      onPress={() => setRole(value)}
                      style={[styles.roleCard, selected && styles.roleCardSelected]}
                    >
                      <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{ROLE_LABEL[value]}</Text>
                      <Text style={[styles.roleBody, selected && styles.roleBodySelected]}>{ROLE_DESCRIPTION[value]}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.inputLabel}>Mensaje opcional</Text>
              <TextInput
                multiline
                maxLength={500}
                value={message}
                onChangeText={setMessage}
                placeholder="Cuéntanos brevemente qué experiencia o disponibilidad puedes aportar."
                placeholderTextColor="#8A8E85"
                style={styles.input}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{message.length}/500</Text>

              {activeInterestForSelectedRole ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>Ya tienes una manifestación activa para este tipo de participación: {STATUS_LABEL[activeInterestForSelectedRole.status]}.</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving || Boolean(activeInterestForSelectedRole)}
                onPress={() => void submit()}
                style={[styles.primaryButton, (saving || activeInterestForSelectedRole) && styles.disabled]}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Registrando…' : 'Registrar mi interés'}</Text>
              </Pressable>
              <Text style={styles.helper}>
                Una aprobación no te añade automáticamente a una cohorte. Esa asignación es un proceso superadmin separado, explícito y auditable.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionKicker}>MIS MANIFESTACIONES</Text>
              <Text style={styles.sectionTitle}>Historial de activación</Text>
              {interests.length === 0 ? (
                <Text style={styles.empty}>Todavía no has registrado interés de activación territorial.</Text>
              ) : (
                <View style={styles.interestList}>
                  {interests.map((interest) => (
                    <View key={interest.id} style={styles.interestCard}>
                      <View style={styles.interestHeader}>
                        <View style={styles.interestCopy}>
                          <Text style={styles.interestTitle}>{ROLE_LABEL[interest.interest_role]}</Text>
                          <Text style={styles.interestMeta}>{STATUS_LABEL[interest.status]} · {new Date(interest.updated_at).toLocaleDateString('es-CO')}</Text>
                        </View>
                        {interest.status !== 'withdrawn' ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={busyInterestId === interest.id}
                            onPress={() => void withdraw(interest)}
                            style={[styles.withdrawButton, busyInterestId === interest.id && styles.disabled]}
                          >
                            <Text style={styles.withdrawText}>{busyInterestId === interest.id ? 'Retirando…' : 'Retirar'}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {interest.message ? <Text style={styles.interestMessage}>{interest.message}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryText}>
                <Text style={styles.boundaryStrong}>Frontera de autoridad. </Text>
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
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 44, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#24573E', fontWeight: '700' },
  hero: { borderRadius: 24, padding: 22, backgroundColor: '#17382A', gap: 10 },
  eyebrow: { color: '#C8D9CF', fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  body: { color: '#5C625A', lineHeight: 21 },
  heroBody: { color: '#D9E4DD', lineHeight: 21 },
  outlineButton: { marginTop: 6, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#769482', paddingHorizontal: 14 },
  outlineButtonText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  muted: { color: '#6C7068' },
  errorCard: { borderRadius: 16, padding: 16, backgroundColor: '#FBE9E7', gap: 4 },
  errorTitle: { color: '#7C2D2D', fontWeight: '700' },
  errorText: { color: '#7C2D2D', lineHeight: 20 },
  noticeCard: { borderRadius: 16, padding: 16, backgroundColor: '#E7EFE9' },
  noticeText: { color: '#2F5B3E', lineHeight: 20 },
  card: { borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF', gap: 14 },
  sectionKicker: { color: '#697068', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  sectionTitle: { color: '#171A15', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  roleList: { gap: 10 },
  roleCard: { borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#DCD9D0', backgroundColor: '#FAF9F5', gap: 4 },
  roleCardSelected: { borderColor: '#17382A', backgroundColor: '#E6EEE8' },
  roleTitle: { color: '#2A3029', fontWeight: '800' },
  roleTitleSelected: { color: '#17382A' },
  roleBody: { color: '#6C7068', lineHeight: 19, fontSize: 13 },
  roleBodySelected: { color: '#3E5547' },
  inputLabel: { color: '#31362F', fontWeight: '700' },
  input: { minHeight: 122, borderRadius: 16, borderWidth: 1, borderColor: '#D6D3CA', backgroundColor: '#FAF9F5', padding: 14, color: '#20251F', lineHeight: 20 },
  counter: { alignSelf: 'flex-end', color: '#858980', fontSize: 12 },
  infoCard: { borderRadius: 14, padding: 13, backgroundColor: '#EEECE4' },
  infoText: { color: '#62675F', lineHeight: 19 },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17382A' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  helper: { color: '#72766E', lineHeight: 18, fontSize: 12 },
  empty: { borderRadius: 14, padding: 14, backgroundColor: '#F1EFE8', color: '#666B62', lineHeight: 20 },
  interestList: { gap: 10 },
  interestCard: { borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E5E2D9', gap: 10 },
  interestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  interestCopy: { flex: 1, gap: 3 },
  interestTitle: { color: '#252A24', fontWeight: '800' },
  interestMeta: { color: '#7A7E75', fontSize: 12 },
  withdrawButton: { minHeight: 38, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#D7C2BE', paddingHorizontal: 12 },
  withdrawText: { color: '#8A3B34', fontWeight: '700', fontSize: 12 },
  interestMessage: { color: '#646960', lineHeight: 20 },
  boundaryCard: { borderRadius: 18, padding: 17, backgroundColor: '#E7EFE9' },
  boundaryText: { color: '#3E5547', lineHeight: 21 },
  boundaryStrong: { fontWeight: '800' },
  disabled: { opacity: 0.5 },
})

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiMutation } from '../../lib/api'
import type {
  CommunitySafetyReason,
  CommunitySafetyReportReceipt,
  CommunitySafetyTargetType,
} from '../../types/community-safety'

const REASONS: Array<{ id: CommunitySafetyReason; label: string; help: string }> = [
  { id: 'harassment', label: 'Acoso o intimidación', help: 'Ataques personales, amenazas o hostigamiento.' },
  { id: 'hate', label: 'Odio o discriminación', help: 'Ataques contra personas o grupos protegidos.' },
  { id: 'sexual_content', label: 'Contenido sexual', help: 'Contenido sexual explícito o explotación.' },
  { id: 'violence', label: 'Violencia o amenaza', help: 'Amenazas, incitación o violencia gráfica indebida.' },
  { id: 'spam', label: 'Spam o fraude', help: 'Promoción engañosa, contenido repetitivo o manipulación.' },
  { id: 'impersonation', label: 'Suplantación', help: 'Un perfil o publicación intenta hacerse pasar por otra persona.' },
  { id: 'privacy', label: 'Privacidad', help: 'Publicación indebida de datos personales o sensibles.' },
  { id: 'other', label: 'Otro incumplimiento', help: 'Otro posible incumplimiento de las Normas de Comunidad.' },
]

const TARGET_TYPES = new Set<CommunitySafetyTargetType>(['profile', 'report', 'proposal', 'publication'])

export default function CommunityReportScreen() {
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string; label?: string }>()
  const targetType = TARGET_TYPES.has(params.targetType as CommunitySafetyTargetType)
    ? params.targetType as CommunitySafetyTargetType
    : null
  const targetId = params.targetId ?? null
  const [reason, setReason] = useState<CommunitySafetyReason>('harassment')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = useMemo(() => Boolean(targetType && targetId), [targetId, targetType])

  async function submit() {
    if (!targetType || !targetId || busy) return
    setBusy(true)
    setError(null)
    try {
      await apiMutation<CommunitySafetyReportReceipt>(
        '/community/safety/reports',
        `mobile-community-report-${targetType}-${targetId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            reason,
            details: details.trim().length >= 5 ? details.trim() : null,
          }),
        },
      )
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible enviar la denuncia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>SEGURIDAD DE LA COMUNIDAD</Text>
          <Text style={styles.title}>Reportar contenido o perfil</Text>
          <Text style={styles.subtitle}>
            La denuncia se envía a moderación. No afecta automáticamente reputación, identidad ni autoridad cívica.
          </Text>
          {params.label ? <Text style={styles.target}>{params.label}</Text> : null}
        </View>

        {!valid ? (
          <Text style={styles.error}>El objetivo de esta denuncia no es válido.</Text>
        ) : sent ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Denuncia recibida</Text>
            <Text style={styles.successText}>El caso quedó en la cola de moderación para revisión.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>¿Qué ocurre?</Text>
            <View style={styles.reasonList}>
              {REASONS.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setReason(item.id)}
                  style={[styles.reasonCard, reason === item.id && styles.reasonCardActive]}
                >
                  <Text style={[styles.reasonTitle, reason === item.id && styles.reasonTitleActive]}>{item.label}</Text>
                  <Text style={[styles.reasonHelp, reason === item.id && styles.reasonHelpActive]}>{item.help}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Contexto adicional (opcional)</Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Describe brevemente qué debería revisar moderación."
              placeholderTextColor="#8A8E87"
              multiline
              maxLength={1000}
              style={styles.textArea}
            />
            <Text style={styles.counter}>{details.length}/1000</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable disabled={busy || !valid} style={[styles.primaryButton, (busy || !valid) && styles.disabled]} onPress={() => void submit()}>
              <Text style={styles.primaryButtonText}>{busy ? 'Enviando…' : 'Enviar a moderación'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  backButton: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: '#E7E4D8' },
  backText: { color: '#263228', fontWeight: '700', fontSize: 12 },
  header: { gap: 7 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: '#697068', fontWeight: '700' },
  title: { fontSize: 27, fontWeight: '800', color: '#11130F' },
  subtitle: { color: '#5F655E', lineHeight: 20 },
  target: { color: '#17382A', fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#171A15' },
  reasonList: { gap: 9 },
  reasonCard: { backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1, borderColor: '#E2E2DC', padding: 13, gap: 4 },
  reasonCardActive: { backgroundColor: '#17382A', borderColor: '#17382A' },
  reasonTitle: { color: '#1D211C', fontWeight: '700' },
  reasonTitleActive: { color: '#FFFFFF' },
  reasonHelp: { color: '#6A7068', fontSize: 12, lineHeight: 17 },
  reasonHelpActive: { color: '#DCE8DF' },
  textArea: { minHeight: 120, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 14, color: '#171A15', textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E2DC' },
  counter: { color: '#777B74', fontSize: 11, textAlign: 'right' },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#17382A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  error: { color: '#8A302A', backgroundColor: '#FBE9E7', borderRadius: 12, padding: 12 },
  successCard: { backgroundColor: '#EEF3EF', borderRadius: 18, padding: 18, gap: 12 },
  successTitle: { color: '#17382A', fontSize: 18, fontWeight: '800' },
  successText: { color: '#3F5B4B', lineHeight: 19 },
})

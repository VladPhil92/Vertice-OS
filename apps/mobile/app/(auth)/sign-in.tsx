import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import { useAuth } from '../../providers/AuthProvider'

export default function SignInScreen() {
  const { signIn, signInWithCtgOne } = useAuth()
  const params = useLocalSearchParams<{ next?: string | string[]; created?: string | string[] }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [federating, setFederating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createdAccount = (Array.isArray(params.created) ? params.created[0] : params.created) === '1'

  async function handleCtgOne() {
    setFederating(true)
    setError(null)
    try {
      await signInWithCtgOne()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible abrir el acceso con CTG One.')
    } finally {
      setFederating(false)
    }
  }

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Ingresa correo y contraseña.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim().toLowerCase(), password)
      const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next
      if (requestedNext === 'territory-select') {
        router.replace('/territory/select')
        return
      }
      router.replace(requestedNext === 'territory-activate' ? '/territory/activate' : '/(tabs)')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.brandShell}>
            <VerticeBrand variant="wordmark" width={176} />
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>RED CÍVICA · COLOMBIA</Text>
            <Text style={styles.title}>Gestión cívica desde tu territorio.</Text>
            <Text style={styles.subtitle}>
              Accede a tu reputación, acciones comunitarias, reportes, propuestas y seguimiento ciudadano.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.identityStripe} accessibilityElementsHidden>
              <View style={[styles.stripeSegment, styles.stripeCitizen]} />
              <View style={[styles.stripeSegment, styles.stripeNavy]} />
              <View style={[styles.stripeSegment, styles.stripeRed]} />
            </View>

            {createdAccount ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>Tu cuenta VÉRTICE ya fue creada</Text>
                <Text style={styles.noticeText}>
                  Ingresa con las credenciales registradas o vincula CTG One desde el flujo seguro de identidad.
                </Text>
              </View>
            ) : null}

            <View style={styles.accessHeader}>
              <Text style={styles.accessEyebrow}>ACCESO CIUDADANO</Text>
              <Text style={styles.accessTitle}>Ingresa a tu cuenta</Text>
              <Text style={styles.accessText}>
                CTG One abre la misma identidad VÉRTICE que ya utilizas en la web; no crea una cuenta móvil separada.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuar con CTG One"
              disabled={federating || submitting}
              onPress={() => void handleCtgOne()}
              style={({ pressed }) => [
                styles.ctgButton,
                pressed && styles.pressed,
                (federating || submitting) && styles.disabled,
              ]}
            >
              <View style={styles.ctgMark} accessibilityElementsHidden>
                <Text style={styles.ctgMarkText}>CTG</Text>
              </View>
              <Text style={styles.ctgButtonText}>{federating ? 'Abriendo CTG One…' : 'Continuar con CTG One'}</Text>
              <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
            </Pressable>

            <Text style={styles.ctgHelper}>
              La autenticación ocurre en CTG One y regresa mediante un código de un solo uso. VÉRTICE no recibe tu contraseña de CTG One.
            </Text>

            <View style={styles.divider} accessibilityElementsHidden>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O USA TU CUENTA VÉRTICE</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="ciudadano@ejemplo.com"
                placeholderTextColor="#A5AFBD"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#A5AFBD"
                style={styles.input}
              />
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting || federating}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                (submitting || federating) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>{submitting ? 'Verificando…' : 'Ingresar'}</Text>
            </Pressable>

            <View style={styles.footerActions}>
              <Text style={styles.footerPrompt}>¿No tienes cuenta VÉRTICE?</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.registerText}>Crear cuenta ciudadana</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.privacyText}>
            Identidad y sesión protegidas por el contrato de seguridad de VÉRTICE y la normativa colombiana de protección de datos.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  brandShell: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  hero: { gap: spacing.sm },
  eyebrow: {
    color: colors.textTertiary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.label,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.displayFamily,
    ...typography.roles.hero,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.subtitle,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    ...elevation.card,
  },
  identityStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    flexDirection: 'row',
  },
  stripeSegment: { flex: 1 },
  stripeCitizen: { backgroundColor: colors.citizen },
  stripeNavy: { backgroundColor: colors.navy },
  stripeRed: { backgroundColor: colors.red },
  noticeCard: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  noticeTitle: {
    color: colors.textPrimary,
    fontFamily: typography.bodyFamily,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
  },
  accessHeader: { marginTop: spacing.xs, gap: spacing.xs },
  accessEyebrow: {
    color: '#D98B00',
    fontFamily: typography.bodyFamily,
    ...typography.roles.label,
  },
  accessTitle: {
    color: colors.textPrimary,
    fontFamily: typography.displayFamily,
    ...typography.roles.title,
  },
  accessText: {
    color: colors.textSecondary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
  },
  ctgButton: {
    minHeight: interaction.buttonHeight,
    borderWidth: 1,
    borderColor: colors.navy,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctgMark: {
    minWidth: 38,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  ctgMarkText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  ctgButtonText: {
    flex: 1,
    color: colors.navy,
    fontFamily: typography.bodyFamily,
    ...typography.roles.button,
  },
  arrow: { color: colors.navy, fontSize: 26, lineHeight: 28, fontWeight: '400' },
  ctgHelper: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xxs },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    color: '#9AA6B5',
    fontFamily: typography.bodyFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  field: { gap: 6 },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.label,
  },
  input: {
    minHeight: interaction.inputHeight,
    borderWidth: 1,
    borderColor: '#D6DFEA',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.bodyFamily,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#F2BDC3',
    borderRadius: radius.md,
    backgroundColor: '#FCEBED',
    padding: spacing.sm,
  },
  error: {
    color: '#A11D2A',
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
  },
  primaryButton: {
    minHeight: interaction.buttonHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: typography.bodyFamily,
    ...typography.roles.button,
  },
  footerActions: { alignItems: 'center', gap: spacing.xxs, paddingTop: spacing.xs },
  footerPrompt: {
    color: colors.textTertiary,
    fontFamily: typography.bodyFamily,
    ...typography.roles.caption,
  },
  registerText: {
    color: colors.navy,
    fontFamily: typography.bodyFamily,
    fontWeight: '800',
    fontSize: 13,
  },
  privacyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: typography.bodyFamily,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: spacing.sm,
  },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

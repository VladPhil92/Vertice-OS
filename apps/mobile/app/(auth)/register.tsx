import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import { isPostRegistrationLoginRequiredError } from '../../lib/registration'
import { useAuth } from '../../providers/AuthProvider'

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (password.length > 128) return 'La contraseña no puede superar 128 caracteres.'
  if (!/[A-Z]/.test(password)) return 'Incluye al menos una letra mayúscula.'
  if (!/[0-9]/.test(password)) return 'Incluye al menos un número.'
  return null
}

export default function RegisterScreen() {
  const { signUp, signInWithCtgOne } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cedula, setCedula] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [federating, setFederating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedCedula = cedula.replace(/\D/g, '')
    if (!normalizedEmail.includes('@')) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!/^\d{6,10}$/.test(normalizedCedula)) {
      setError('La cédula debe contener entre 6 y 10 dígitos.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await signUp(normalizedEmail, password, normalizedCedula)
      router.replace('/territory/select')
    } catch (cause) {
      if (isPostRegistrationLoginRequiredError(cause)) {
        router.replace({
          pathname: '/(auth)/sign-in',
          params: { next: 'territory-select', created: '1' },
        })
        return
      }
      setError(cause instanceof Error ? cause.message : 'No fue posible crear tu cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandShell}>
            <VerticeBrand variant="wordmark" width={168} />
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>IDENTIDAD CIUDADANA · COLOMBIA</Text>
            <Text style={styles.title}>Crea tu cuenta VÉRTICE</Text>
            <Text style={styles.subtitle}>
              La cuenta es nacional y funciona tanto en la web como en la aplicación. Después elegirás tu municipio o distrito.
            </Text>
          </View>

          <View style={styles.ctgCard}>
            <Text style={styles.ctgTitle}>¿Ya tienes una cuenta CTG One?</Text>
            <Text style={styles.ctgText}>
              No crees otra cuenta. Ingresa con CTG One y VÉRTICE abrirá o vinculará tu misma identidad ciudadana.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={federating || submitting}
              onPress={() => void handleCtgOne()}
              style={({ pressed }) => [styles.ctgButton, pressed && styles.pressed, (federating || submitting) && styles.disabled]}
            >
              <Text style={styles.ctgButtonText}>{federating ? 'Abriendo CTG One…' : 'Continuar con CTG One'}</Text>
              <VerticeIcon name="chevronRight" color={colors.navy} size={20} />
            </Pressable>
          </View>

          <View style={styles.divider} accessibilityElementsHidden>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>O CREA UNA CUENTA VÉRTICE</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.card}>
            <View style={styles.identityStripe} accessibilityElementsHidden>
              <View style={[styles.stripeSegment, styles.stripeCitizen]} />
              <View style={[styles.stripeSegment, styles.stripeNavy]} />
              <View style={[styles.stripeSegment, styles.stripeRed]} />
            </View>

            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="ciudadano@ejemplo.com"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />

            <Text style={styles.label}>CONTRASEÑA</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />

            <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />

            <Text style={styles.label}>CÉDULA DE CIUDADANÍA</Text>
            <TextInput
              autoComplete="off"
              keyboardType="number-pad"
              value={cedula}
              onChangeText={(value) => setCedula(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Solo dígitos, 6–10 caracteres"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />
            <Text style={styles.helper}>
              El servidor transforma la cédula mediante HMAC-SHA-256 y no la almacena en texto plano. Registrar este dato no equivale a identidad cívica verificada ni a residencia territorial verificada.
            </Text>

            {error ? (
              <View style={styles.errorCard}>
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting || federating}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (submitting || federating) && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>{submitting ? 'Creando cuenta…' : 'Crear cuenta VÉRTICE'}</Text>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Ya tengo cuenta · Ingresar</Text>
            </Pressable>
          </View>

          <View style={styles.boundaryCard}>
            <Text style={styles.boundaryText}>
              <Text style={styles.boundaryStrong}>Paso siguiente: territorio. </Text>
              Elegir municipio o distrito declara contexto de producto; no concede reputación, voto, autoridad ni territory assurance.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: 44, gap: spacing.lg },
  brandShell: { alignSelf: 'center', borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  hero: { paddingTop: spacing.xs, gap: spacing.sm },
  eyebrow: { color: colors.textTertiary, ...typography.roles.label },
  title: { color: colors.textPrimary, ...typography.roles.hero },
  subtitle: { color: colors.textSecondary, ...typography.roles.body },
  ctgCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt, padding: spacing.lg, gap: spacing.sm },
  ctgTitle: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  ctgText: { color: colors.textSecondary, ...typography.roles.caption },
  ctgButton: { minHeight: interaction.minimumTouchTarget, borderWidth: 1, borderColor: colors.navy, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', gap: spacing.sm },
  ctgButtonText: { flex: 1, color: colors.navy, ...typography.roles.button },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  card: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, ...elevation.card },
  identityStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, flexDirection: 'row' },
  stripeSegment: { flex: 1 },
  stripeCitizen: { backgroundColor: colors.citizen },
  stripeNavy: { backgroundColor: colors.navy },
  stripeRed: { backgroundColor: colors.red },
  label: { marginTop: spacing.xs, color: colors.textSecondary, ...typography.roles.label },
  input: { minHeight: interaction.inputHeight, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary, fontFamily: typography.bodyFamily },
  helper: { color: colors.textTertiary, ...typography.roles.caption },
  errorCard: { borderWidth: 1, borderColor: colors.errorBorder, borderRadius: radius.md, backgroundColor: colors.errorBackground, padding: spacing.sm },
  error: { color: colors.errorText, ...typography.roles.caption },
  primaryButton: { marginTop: spacing.xs, minHeight: interaction.buttonHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.navy },
  primaryButtonText: { color: colors.white, ...typography.roles.button },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, fontWeight: '800' },
  boundaryCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  boundaryText: { color: colors.textSecondary, fontFamily: typography.bodyFamily, lineHeight: 21 },
  boundaryStrong: { color: colors.textPrimary, fontFamily: typography.bodyExtraBoldFamily, fontWeight: '800' },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
})

import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../providers/AuthProvider'

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (password.length > 128) return 'La contraseña no puede superar 128 caracteres.'
  if (!/[A-Z]/.test(password)) return 'Incluye al menos una letra mayúscula.'
  if (!/[0-9]/.test(password)) return 'Incluye al menos un número.'
  return null
}

export default function RegisterScreen() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cedula, setCedula] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(cause instanceof Error ? cause.message : 'No fue posible crear tu cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>VÉRTICE · COLOMBIA</Text>
            <Text style={styles.title}>Crea tu cuenta ciudadana</Text>
            <Text style={styles.subtitle}>
              Tu cuenta es nacional. Después elegirás tu municipio o distrito para personalizar la experiencia local.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="ciudadano@ejemplo.com"
              style={styles.input}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
              style={styles.input}
            />

            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña"
              style={styles.input}
            />

            <Text style={styles.label}>Cédula de ciudadanía</Text>
            <TextInput
              autoComplete="off"
              keyboardType="number-pad"
              value={cedula}
              onChangeText={(value) => setCedula(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Solo dígitos, 6–10 caracteres"
              style={styles.input}
            />
            <Text style={styles.helper}>
              El servidor transforma la cédula mediante HMAC-SHA-256 y no la almacena en texto plano. Registrar este dato no equivale a identidad cívica verificada ni a residencia territorial verificada.
            </Text>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void handleSubmit()}
              style={[styles.primaryButton, submitting && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>{submitting ? 'Creando cuenta…' : 'Crear cuenta'}</Text>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Ya tengo cuenta · Ingresar</Text>
            </Pressable>
          </View>

          <View style={styles.boundaryCard}>
            <Text style={styles.boundaryText}>
              <Text style={styles.boundaryStrong}>Paso siguiente: territorio. </Text>
              Elegir municipio o distrito será una declaración de contexto de producto; no concede reputación, voto, autoridad ni territory assurance.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 22, paddingBottom: 44, gap: 18 },
  hero: { paddingTop: 12, gap: 10 },
  eyebrow: { fontSize: 12, letterSpacing: 1.8, fontWeight: '800', color: '#5D695F' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: '#11130F' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#5B5E55' },
  card: { borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF', gap: 10 },
  label: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#24271F' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#D3D0C6', borderRadius: 14, backgroundColor: '#FAF9F5', paddingHorizontal: 15, fontSize: 16, color: '#11130F' },
  helper: { color: '#70756D', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 6, color: '#9B2C2C', lineHeight: 20 },
  primaryButton: { marginTop: 10, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#17382A' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#24573E', fontWeight: '700' },
  boundaryCard: { borderRadius: 18, padding: 17, backgroundColor: '#E7EFE9' },
  boundaryText: { color: '#3E5547', lineHeight: 21 },
  boundaryStrong: { fontWeight: '800' },
  disabled: { opacity: 0.55 },
})

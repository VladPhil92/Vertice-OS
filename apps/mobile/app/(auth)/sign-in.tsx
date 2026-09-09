import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../providers/AuthProvider'

export default function SignInScreen() {
  const { signIn } = useAuth()
  const params = useLocalSearchParams<{ next?: string | string[]; created?: string | string[] }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createdAccount = (Array.isArray(params.created) ? params.created[0] : params.created) === '1'

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
      if (requestedNext === 'territory-activate') {
        router.replace('/territory/activate')
        return
      }
      if (requestedNext === 'territory-select') {
        router.replace('/territory/select')
        return
      }
      router.replace('/(tabs)')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>VÉRTICE OS · COLOMBIA</Text>
          <Text style={styles.title}>Gestión cívica desde tu territorio.</Text>
          <Text style={styles.subtitle}>
            Accede a tu reputación, acciones comunitarias, reportes, propuestas y seguimiento ciudadano.
          </Text>
        </View>

        <View style={styles.form}>
          {createdAccount ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Tu cuenta ya fue creada</Text>
              <Text style={styles.noticeText}>
                La sesión automática no pudo completarse. Ingresa con las credenciales que acabas de registrar y continuarás al selector territorial nacional.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            style={styles.input}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            style={styles.input}
          />

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, submitting && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{submitting ? 'Ingresando…' : 'Ingresar'}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')} style={styles.registerButton}>
            <Text style={styles.registerText}>Crear cuenta ciudadana</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 36 },
  hero: { gap: 12 },
  eyebrow: { fontSize: 13, letterSpacing: 2.1, fontWeight: '700', color: '#5C5A4D' },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '700', color: '#11130F' },
  subtitle: { fontSize: 16, lineHeight: 24, color: '#5B5E55' },
  form: { gap: 10 },
  noticeCard: { borderRadius: 14, backgroundColor: '#E7EFE9', padding: 14, gap: 4 },
  noticeTitle: { color: '#234A32', fontWeight: '800' },
  noticeText: { color: '#3E5547', lineHeight: 19, fontSize: 13 },
  label: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#24271F' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#D3D0C6', borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontSize: 16, color: '#11130F' },
  error: { marginTop: 6, color: '#9B2C2C', lineHeight: 20 },
  button: { marginTop: 14, minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C3D2E' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  registerButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  registerText: { color: '#24573E', fontWeight: '700' },
})

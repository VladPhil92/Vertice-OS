import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../providers/AuthProvider'

const REQUIRED_CONFIRMATION = 'ELIMINAR'

export default function AccountDeletionScreen() {
  const { deleteAccount } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const canDelete = confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION && !busy

  async function executeDeletion() {
    if (!canDelete) return

    Alert.alert(
      'Eliminar cuenta de forma permanente',
      'Esta acción elimina tus credenciales e identidad personal de VÉRTICE y no puede deshacerse.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar definitivamente',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true)
              try {
                await deleteAccount()
                router.replace('/(auth)/sign-in')
                Alert.alert(
                  'Cuenta eliminada',
                  'Tus credenciales e identidad personal fueron eliminadas. Algunos registros cívicos, financieros o de auditoría pueden conservarse únicamente de forma seudonimizada cuando exista una obligación de integridad o retención.',
                )
              } catch (cause) {
                Alert.alert(
                  'No fue posible eliminar la cuenta',
                  cause instanceof Error ? cause.message : 'Vuelve a iniciar sesión e intenta nuevamente.',
                )
              } finally {
                setBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>PRIVACIDAD Y DATOS</Text>
          <Text style={styles.title}>Eliminar mi cuenta</Text>
          <Text style={styles.lead}>
            VÉRTICE ofrece eliminación de cuenta dentro de la aplicación. No necesitas contactar soporte para iniciar el proceso.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Se elimina de forma irreversible</Text>
          <Text style={styles.item}>• correo, hash de documento y contraseña</Text>
          <Text style={styles.item}>• sesiones, roles activos e identidades federadas</Text>
          <Text style={styles.item}>• proofing/KYC cívico y referencias del proveedor</Text>
          <Text style={styles.item}>• dispositivos push, perfil público, avatar y red de seguidores</Text>
          <Text style={styles.item}>• publicaciones sociales programadas o publicadas</Text>
        </View>

        <View style={styles.retentionCard}>
          <Text style={styles.cardTitle}>Qué puede conservarse</Text>
          <Text style={styles.body}>
            Registros cívicos, financieros y de auditoría pueden conservarse cuando sean necesarios para integridad histórica, contabilidad, prevención de fraude o resolución de disputas. La relación personal directa se elimina o se seudonimiza y tu perfil deja de ser público.
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Esta acción no se puede deshacer</Text>
          <Text style={styles.body}>
            Para evitar eliminaciones accidentales, escribe {REQUIRED_CONFIRMATION} y confirma nuevamente en el diálogo del sistema.
          </Text>
          <TextInput
            accessibilityLabel="Confirmación para eliminar la cuenta"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setConfirmation}
            placeholder={REQUIRED_CONFIRMATION}
            style={styles.input}
            value={confirmation}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDelete }}
            disabled={!canDelete}
            onPress={() => void executeDeletion()}
            style={({ pressed }) => [
              styles.deleteButton,
              !canDelete && styles.disabled,
              pressed && canDelete && styles.pressed,
            ]}
          >
            <Text style={styles.deleteButtonText}>{busy ? 'Eliminando…' : 'Eliminar mi cuenta'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  container: { padding: 20, paddingBottom: 40, gap: 16 },
  backButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backButtonText: { color: '#17382A', fontWeight: '700' },
  header: { gap: 8, marginBottom: 2 },
  eyebrow: { fontSize: 12, letterSpacing: 1.8, fontWeight: '800', color: '#697068' },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '800', color: '#11130F' },
  lead: { fontSize: 16, lineHeight: 23, color: '#565D54' },
  card: { borderRadius: 20, padding: 18, backgroundColor: '#FFFFFF', gap: 8 },
  retentionCard: { borderRadius: 20, padding: 18, backgroundColor: '#E7E4D8', gap: 8 },
  warningCard: { borderRadius: 20, padding: 18, backgroundColor: '#F4DFDC', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171A15' },
  warningTitle: { fontSize: 18, fontWeight: '800', color: '#812F2F' },
  item: { color: '#565D54', lineHeight: 20 },
  body: { color: '#565D54', lineHeight: 21 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#BE9C96',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    color: '#171A15',
  },
  deleteButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#812F2F',
  },
  deleteButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
})

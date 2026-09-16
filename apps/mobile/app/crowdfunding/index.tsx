import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'

// Crowdfunding on mobile is intentionally an announcement, not a product
// surface, until the payment providers (Mercado Pago/Wompi) and payout
// certification are live. Building a partial create/contribute flow ahead of
// that would let a citizen believe money can move today when it can't.
const LAUNCH_MONTH = 'octubre de 2026'

export default function CrowdfundingScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="timeline" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>PRÓXIMAMENTE</Text>
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
            <VerticeIcon name="notifications" color={colors.white} size={27} />
          </View>
          <Text style={styles.eyebrow}>RECAUDO COMUNITARIO</Text>
          <Text style={styles.title}>Crowdfunding llega en {LAUNCH_MONTH}</Text>
          <Text style={styles.heroBody}>
            Estamos terminando la verificación de identidad y de los proveedores de pago para que crear una campaña y contribuir a ella sea seguro desde el primer día. Te avisaremos aquí y por notificación cuando esté disponible.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <VerticeIcon name="shield" color={colors.infoText} size={22} />
          <View style={styles.infoCopy}>
            <Text style={styles.infoKicker}>QUÉ VA A CAMBIAR</Text>
            <Text style={styles.infoText}>
              Cuando se active, podrás crear tu propia campaña, ver las de tu comunidad y contribuir directamente desde el celular. Mientras tanto, esta sección no procesa dinero ni recibe compromisos financieros.
            </Text>
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
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  heroBody: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.body },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  infoCopy: { flex: 1, gap: spacing.xxs },
  infoKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  infoText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  boundaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  boundaryText: { flex: 1, color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  pressed: { opacity: interaction.pressedOpacity },
})

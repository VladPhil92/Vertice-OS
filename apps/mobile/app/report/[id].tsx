import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VerticeBrand } from '../../components/VerticeBrand'
import { VerticeIcon } from '../../components/VerticeIcon'
import { apiFetch } from '../../lib/api'
import { colors, elevation, interaction, radius, spacing, typography } from '../../theme/vertice'
import type { ReportCategory, ReportStatus, TerritorialReportDetail } from '../../types/api'

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Abierto',
  in_progress: 'En gestión',
  resolved: 'Resuelto',
  rejected: 'Rechazado',
  duplicate: 'Duplicado',
}

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  infraestructura: 'Infraestructura',
  servicios_publicos: 'Servicios públicos',
  seguridad: 'Seguridad',
  medio_ambiente: 'Medio ambiente',
  transporte: 'Transporte',
  salud: 'Salud',
  educacion: 'Educación',
  cultura: 'Cultura',
  otro: 'Otro',
}

function statusTone(status: ReportStatus) {
  if (status === 'resolved') return styles.statusSuccess
  if (status === 'in_progress') return styles.statusWarning
  if (status === 'rejected') return styles.statusError
  if (status === 'open') return styles.statusInfo
  return styles.statusNeutral
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const reportId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id
    return raw ? decodeURIComponent(raw) : ''
  }, [params.id])
  const [report, setReport] = useState<TerritorialReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!reportId) {
      setError('Reporte inválido.')
      setLoading(false)
      return
    }

    setError(null)
    setLoading(true)
    try {
      setReport(await apiFetch<TerritorialReportDetail>(`/territorial/reports/${encodeURIComponent(reportId)}`, { public: true }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el reporte.')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => { void load() }, [load])

  async function openMap() {
    if (!report) return
    const coordinates = `${report.lat},${report.lng}`
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <VerticeBrand variant="wordmark" width={120} />
          <View style={styles.sectionBadge}>
            <VerticeIcon name="report" color={colors.navy} size={16} />
            <Text style={styles.sectionBadgeText}>REPORTE</Text>
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

        {loading ? (
          <View style={styles.stateCard}>
            <VerticeIcon name="report" color={colors.azure} size={24} />
            <Text style={styles.muted}>Cargando reporte…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No pudimos cargar el reporte</Text>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <VerticeIcon name="refresh" color={colors.navy} size={18} />
              <Text style={styles.secondaryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {report ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <VerticeIcon name="report" color={colors.white} size={24} />
              </View>
              <Text style={styles.eyebrow}>{CATEGORY_LABEL[report.category].toUpperCase()}</Text>
              <Text style={styles.title}>{report.title}</Text>
              <Text style={styles.description}>{report.description}</Text>
              <View style={[styles.statusPill, statusTone(report.status)]}>
                <Text style={styles.statusText}>{STATUS_LABEL[report.status]}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}>
                  <VerticeIcon name="map" color={colors.navy} size={20} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionKicker}>CONTEXTO TERRITORIAL</Text>
                  <Text style={styles.sectionTitle}>Ubicación reportada</Text>
                </View>
              </View>
              <Text style={styles.body}>{report.neighborhood ?? 'Barrio no especificado'}</Text>
              {report.address_reference ? <Text style={styles.muted}>{report.address_reference}</Text> : null}
              <Text style={styles.coordinates}>{report.lat.toFixed(6)}, {report.lng.toFixed(6)}</Text>
              <Pressable accessibilityRole="link" onPress={() => void openMap()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <VerticeIcon name="map" color={colors.navy} size={18} />
                <Text style={styles.primaryText}>Abrir ubicación en mapa</Text>
              </Pressable>
            </View>

            {report.urgency_score !== null ? (
              <View style={styles.signalCard}>
                <View style={styles.signalIcon}>
                  <VerticeIcon name="signal" color={colors.infoText} size={20} />
                </View>
                <View style={styles.signalCopy}>
                  <Text style={styles.signalLabel}>URGENCIA REGISTRADA</Text>
                  <Text style={styles.signalValue}>{report.urgency_score}</Text>
                  <Text style={styles.signalBody}>Esta señal ayuda a priorizar lectura operativa del reporte; no constituye por sí sola una decisión institucional.</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}>
                  <VerticeIcon name="evidence" color={colors.navy} size={20} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionKicker}>EVIDENCIA PÚBLICA</Text>
                  <Text style={styles.sectionTitle}>Archivos asociados</Text>
                </View>
              </View>
              {report.media_urls.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                  {report.media_urls.map((url, index) => (
                    <Image
                      key={url}
                      accessibilityRole="image"
                      accessibilityLabel={`Evidencia ${index + 1} del reporte`}
                      source={{ uri: url }}
                      style={styles.mediaImage}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyCard}>
                  <VerticeIcon name="evidence" color={colors.textTertiary} size={22} />
                  <Text style={styles.muted}>Este reporte todavía no tiene evidencia fotográfica publicada.</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}>
                  <VerticeIcon name="timeline" color={colors.navy} size={20} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionKicker}>TRAZABILIDAD</Text>
                  <Text style={styles.sectionTitle}>Historial temporal</Text>
                </View>
              </View>
              <View style={styles.timelineList}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineLabel}>Creado</Text>
                    <Text style={styles.timelineValue}>{formatDate(report.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineLabel}>Última actualización</Text>
                    <Text style={styles.timelineValue}>{formatDate(report.updated_at)}</Text>
                  </View>
                </View>
                {report.resolved_at ? (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, styles.timelineDotResolved]} />
                    <View style={styles.timelineCopy}>
                      <Text style={styles.timelineLabel}>Resuelto</Text>
                      <Text style={styles.timelineValue}>{formatDate(report.resolved_at)}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.boundaryCard}>
              <Text style={styles.boundaryKicker}>FRONTERA DE EVIDENCIA</Text>
              <Text style={styles.boundaryText}>
                Un reporte público documenta una señal territorial y su trazabilidad. El estado visible no reemplaza una decisión oficial, no concede reputación automática y no prueba identidad o residencia de quien lo originó.
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
  content: { padding: spacing.lg, paddingBottom: spacing.hero, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.infoBackground, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sectionBadgeText: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  backButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.navy, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  stateCard: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  hero: { borderRadius: radius.xxl, padding: spacing.xl, backgroundColor: colors.navy, gap: spacing.sm },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight },
  eyebrow: { color: colors.citizen, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  title: { color: colors.white, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.hero },
  description: { color: colors.white, fontFamily: typography.bodyFamily, ...typography.roles.subtitle },
  statusPill: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusText: { color: colors.textPrimary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  statusSuccess: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  statusInfo: { backgroundColor: colors.infoBackground, borderColor: colors.infoBorder },
  statusWarning: { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder },
  statusError: { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder },
  statusNeutral: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  card: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sectionCopy: { flex: 1, gap: spacing.xxs },
  sectionKicker: { color: colors.textTertiary, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.displayExtraBoldFamily, ...typography.roles.title },
  body: { color: colors.textSecondary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  muted: { color: colors.textTertiary, fontFamily: typography.bodyFamily, ...typography.roles.body },
  coordinates: { color: colors.navy, fontFamily: typography.monoFamily, ...typography.roles.mono },
  primaryButton: { minHeight: interaction.buttonHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.citizen, paddingHorizontal: spacing.md },
  primaryText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  secondaryButton: { minHeight: interaction.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.borderActive, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryText: { color: colors.navy, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.button },
  mediaRow: { gap: spacing.sm },
  mediaImage: { width: 240, height: 180, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  emptyCard: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  signalCard: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder },
  signalIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  signalCopy: { flex: 1, gap: spacing.xxs },
  signalLabel: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  signalValue: { color: colors.navy, fontFamily: typography.displayExtraBoldFamily, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  signalBody: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  timelineList: { gap: spacing.sm },
  timelineItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  timelineDot: { width: 10, height: 10, borderRadius: radius.pill, marginTop: spacing.xs, backgroundColor: colors.azure },
  timelineDotResolved: { backgroundColor: colors.emerald },
  timelineCopy: { flex: 1, gap: spacing.xxs },
  timelineLabel: { color: colors.textPrimary, fontFamily: typography.bodyBoldFamily, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  timelineValue: { color: colors.textTertiary, fontFamily: typography.bodySemiboldFamily, ...typography.roles.caption },
  errorCard: { backgroundColor: colors.errorBackground, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.errorBorder, padding: spacing.md, gap: spacing.sm },
  errorTitle: { color: colors.errorText, fontFamily: typography.displayBoldFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  error: { color: colors.errorText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  boundaryCard: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.infoBackground, borderWidth: 1, borderColor: colors.infoBorder, gap: spacing.xs },
  boundaryKicker: { color: colors.infoText, fontFamily: typography.bodyExtraBoldFamily, ...typography.roles.label },
  boundaryText: { color: colors.infoText, fontFamily: typography.bodyFamily, ...typography.roles.body },
  pressed: { opacity: interaction.pressedOpacity },
})

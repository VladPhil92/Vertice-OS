'use client'

// ── Mapa territorial interactivo — react-map-gl + mapbox-gl v3
// Este componente se carga SÓLO en el cliente (dynamic import con ssr:false).

import { useState, useCallback } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { X, AlertTriangle, MapPin } from 'lucide-react'
import { CategoryTag } from './CategoryTag'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ReportCategory =
  | 'infraestructura'
  | 'servicios_publicos'
  | 'seguridad'
  | 'salud'
  | 'educacion'
  | 'medio_ambiente'
  | 'transporte'
  | 'cultura'
  | 'otro'

export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate'

export interface MapReport {
  id: string
  title: string
  category: ReportCategory
  status: ReportStatus
  urgency_score: number | null
  neighborhood: string | null
  created_at: string
  lat: number
  lng: number
}

// ── Constantes — Sistema 2 colores por módulo ────────────────────────────────

export const CATEGORY_COLOR: Record<ReportCategory | 'otro', string> = {
  infraestructura:    '#1A7FBF',
  servicios_publicos: '#4ECDC4',
  seguridad:          '#C0392B',
  salud:              '#27AE60',
  educacion:          '#FFB522',
  medio_ambiente:     '#27AE60',
  transporte:         '#1A7FBF',
  cultura:            '#E67E22',
  otro:               '#C8A84B',
}

export const CATEGORY_LABEL: Record<ReportCategory | 'otro', string> = {
  infraestructura:    'Infraestructura',
  servicios_publicos: 'Servicios Públicos',
  seguridad:          'Seguridad',
  salud:              'Salud',
  educacion:          'Educación',
  medio_ambiente:     'Medio Ambiente',
  transporte:         'Transporte',
  cultura:            'Cultura',
  otro:               'Otro',
}

const STATUS_TAG: Record<ReportStatus, 'urgente' | 'pendiente' | 'resuelto' | 'nuevo'> = {
  open:        'nuevo',
  in_progress: 'pendiente',
  resolved:    'resuelto',
  rejected:    'urgente',
  duplicate:   'pendiente',
}

// Cartagena de Indias — centro del mapa
const CTG_CENTER = { longitude: -75.4794, latitude: 10.3910 } as const

// ── Marker ───────────────────────────────────────────────────────────────────

function ReportPin({
  report,
  onClick,
  selected,
}: {
  report: MapReport
  onClick: () => void
  selected: boolean
}) {
  const color  = CATEGORY_COLOR[report.category] ?? '#C8A84B'
  const dim    = report.status === 'resolved' || report.status === 'rejected'
  const urg    = report.urgency_score ?? 0.5
  const size   = Math.round(13 + urg * 9)          // 13–22 px

  return (
    <button
      onClick={onClick}
      aria-label={report.title}
      style={{
        width:           size,
        height:          size,
        borderRadius:    '50%',
        backgroundColor: dim ? `${color}60` : color,
        border:          selected
          ? '2.5px solid #F0EDE8'
          : `2px solid ${color}50`,
        boxShadow: selected
          ? `0 0 0 4px ${color}40, 0 2px 10px rgba(0,0,0,0.6)`
          : `0 0 0 2px ${color}20, 0 2px 6px rgba(0,0,0,0.4)`,
        cursor:  'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        transform: selected ? 'scale(1.3)' : 'scale(1)',
      }}
    />
  )
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function ReportPopup({ report, onClose }: { report: MapReport; onClose: () => void }) {
  const color = CATEGORY_COLOR[report.category] ?? '#C8A84B'

  return (
    <div className="relative p-4 pr-8">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-2 top-2 text-tertiary transition-colors hover:text-primary"
        aria-label="Cerrar"
      >
        <X size={13} />
      </button>

      {/* Category accent */}
      <div className="mb-2 h-0.5 w-8" style={{ backgroundColor: color }} />

      {/* Title */}
      <h3 className="font-display text-[13px] font-semibold leading-snug text-primary">
        {report.title}
      </h3>

      {/* Meta */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <CategoryTag variant={STATUS_TAG[report.status]} />
        <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>
          {CATEGORY_LABEL[report.category]}
        </span>
      </div>

      {report.neighborhood && (
        <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-tertiary">
          <MapPin size={9} />
          {report.neighborhood}
        </p>
      )}

      {/* Link */}
      <a
        href={`/dashboard/reports/${report.id}`}
        className="mt-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-gold transition-opacity hover:opacity-70"
      >
        Ver detalle →
      </a>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface TerritorialMapProps {
  reports: MapReport[]
  height?: string
  interactive?: boolean    // si false: vista sólo lectura (para detail page)
  centerLat?: number
  centerLng?: number
  zoom?: number
  singlePin?: boolean      // reservado para compatibilidad con modo detalle
}

export function TerritorialMap({
  reports,
  height = '100%',
  interactive = true,
  centerLat  = CTG_CENTER.latitude,
  centerLng  = CTG_CENTER.longitude,
  zoom       = 12,
  singlePin: _singlePin = false,
}: TerritorialMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id)
  }, [])

  if (!token) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 border border-border bg-surface"
        style={{ height }}
      >
        <AlertTriangle size={20} strokeWidth={1.5} className="text-gold" />
        <p className="font-mono text-[11px] text-secondary">
          Configura <code className="text-gold">NEXT_PUBLIC_MAPBOX_TOKEN</code> para ver el mapa
        </p>
      </div>
    )
  }

  const selected = reports.find(r => r.id === selectedId)

  return (
    <div style={{ height, position: 'relative' }}>
      <Map
        mapboxAccessToken={token}
        initialViewState={{ longitude: centerLng, latitude: centerLat, zoom }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactive={interactive}
        attributionControl={false}
      >
        {interactive && (
          <NavigationControl position="top-right" showCompass={false} />
        )}

        {/* Markers */}
        {reports.map(report => (
          <Marker
            key={report.id}
            longitude={report.lng}
            latitude={report.lat}
            anchor="center"
          >
            <ReportPin
              report={report}
              onClick={() => handleMarkerClick(report.id)}
              selected={selectedId === report.id}
            />
          </Marker>
        ))}

        {/* Popup */}
        {selected && interactive && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            offset={20}
            onClose={() => setSelectedId(null)}
            closeButton={false}
            closeOnClick={false}
          >
            <ReportPopup report={selected} onClose={() => setSelectedId(null)} />
          </Popup>
        )}
      </Map>
    </div>
  )
}

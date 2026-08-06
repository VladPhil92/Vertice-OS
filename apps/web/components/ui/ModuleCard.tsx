'use client'

// ── Sistema de Ítems — Sistema 2
// Tarjetas de módulo territorial con iconos y colores semánticos.

import {
  Car,
  Droplets,
  ShieldCheck,
  Heart,
  GraduationCap,
  Wrench,
  Palette,
  Building2,
  Info,
  Users,
  AlertTriangle,
  Eye,
  Database,
  BookOpen,
  Calendar,
  type LucideIcon,
} from 'lucide-react'

// ── Módulos territoriales (Sistema 2 — módulos por iconos) ────────────────────

export interface ModuleConfig {
  id: string
  label: string
  sublabel: string
  icon: LucideIcon
  color: string       // hex
  href: string
  count?: number
}

export const TERRITORIAL_MODULES: ModuleConfig[] = [
  { id: 'mobility',  label: 'Movilidad',  sublabel: 'Vías y transporte',    icon: Car,          color: '#1A7FBF', href: '/dashboard/reports?category=infraestructura' },
  { id: 'water',     label: 'Agua',       sublabel: 'Servicios públicos',   icon: Droplets,     color: '#4ECDC4', href: '/dashboard/reports?category=servicios_publicos' },
  { id: 'security',  label: 'Seguridad',  sublabel: 'Convivencia y orden',  icon: ShieldCheck,  color: '#C0392B', href: '/dashboard/reports?category=seguridad' },
  { id: 'health',    label: 'Salud',      sublabel: 'Atención médica',      icon: Heart,        color: '#27AE60', href: '/dashboard/reports?category=salud' },
  { id: 'education', label: 'Educación',  sublabel: 'Colegios y cultura',   icon: GraduationCap,color: '#FFB522', href: '/dashboard/reports?category=educacion' },
  { id: 'services',  label: 'Servicios',  sublabel: 'Trámites y gestión',   icon: Wrench,       color: '#8E44AD', href: '/dashboard/ai' },
  { id: 'culture',   label: 'Cultura',    sublabel: 'Arte y patrimonio',    icon: Palette,      color: '#E67E22', href: '/dashboard/reports?category=cultura' },
  { id: 'economy',   label: 'Gobierno',   sublabel: 'Propuestas y voto',    icon: Building2,    color: '#1A2744', href: '/dashboard/proposals' },
]

// ── Categorías del Sistema de Ítems (top 7 de System 2) ──────────────────────

export const ITEM_CATEGORIES: ModuleConfig[] = [
  { id: 'info',            label: 'Información',    sublabel: 'Guías y noticias',   icon: Info,          color: '#1A2744', href: '/dashboard' },
  { id: 'participation',   label: 'Participación',  sublabel: 'Propuestas y votos', icon: Users,         color: '#FFB522', href: '/dashboard/proposals' },
  { id: 'reports',         label: 'Reportes',       sublabel: 'Problemas urbanos',  icon: AlertTriangle, color: '#C0392B', href: '/dashboard/reports' },
  { id: 'transparency',    label: 'Transparencia',  sublabel: 'Datos abiertos',     icon: Eye,           color: '#1A7FBF', href: '/dashboard/governance' },
  { id: 'data',            label: 'Datos',          sublabel: 'Estadísticas',       icon: Database,      color: '#4ECDC4', href: '/dashboard/reputation' },
  { id: 'education',       label: 'Educación',      sublabel: 'Tutoriales',         icon: BookOpen,      color: '#27AE60', href: '/dashboard/ai' },
  { id: 'events',          label: 'Eventos',        sublabel: 'Reuniones y cabildos',icon: Calendar,     color: '#8E44AD', href: '/dashboard' },
]

// ── Componente ────────────────────────────────────────────────────────────────

interface ModuleCardProps {
  module: ModuleConfig
  size?: 'sm' | 'md'
  showCount?: boolean
}

export function ModuleCard({ module, size = 'md', showCount = false }: ModuleCardProps) {
  const { label, sublabel, icon: Icon, color, href, count } = module
  const iconSize = size === 'sm' ? 16 : 20
  const padding  = size === 'sm' ? 'p-4' : 'p-5'

  return (
    <a
      href={href}
      className={[
        'group relative flex flex-col gap-3 border border-border bg-surface transition-all',
        'hover:border-border-active hover:bg-surface-2',
        padding,
      ].join(' ')}
    >
      {/* Icon circle */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-sm transition-transform group-hover:scale-105"
        style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon size={iconSize} style={{ color }} strokeWidth={1.5} />
      </div>

      {/* Labels */}
      <div>
        <div className="font-display text-[13px] font-semibold text-primary transition-colors group-hover:text-white">
          {label}
        </div>
        {size === 'md' && (
          <div className="mt-0.5 font-mono text-[10px] text-tertiary">
            {sublabel}
          </div>
        )}
      </div>

      {/* Count badge */}
      {showCount && count !== undefined && (
        <div
          className="absolute right-3 top-3 rounded-sm px-1.5 py-0.5 font-mono text-[9px]"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {count}
        </div>
      )}

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full"
        style={{ backgroundColor: color }}
      />
    </a>
  )
}

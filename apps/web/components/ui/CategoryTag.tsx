'use client'

// ── Sistema de Ítems — Sistema 2
// Tags de categoría/estado con la paleta semántica institucional.

type TagVariant =
  | 'ambiente'
  | 'social'
  | 'urgente'
  | 'nuevo'
  | 'servicios'
  | 'tendencia'
  | 'destacado'
  | 'resuelto'
  | 'pendiente'
  | 'activo'

interface CategoryTagProps {
  variant: TagVariant | string
  label?: string
  size?: 'sm' | 'md'
}

const TAG_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  ambiente:   { bg: 'bg-cyan/10',         text: 'text-cyan',        dot: 'bg-cyan'        },
  social:     { bg: 'bg-azure/10',        text: 'text-azure',       dot: 'bg-azure'       },
  urgente:    { bg: 'bg-red/10',          text: 'text-red',         dot: 'bg-red'         },
  nuevo:      { bg: 'bg-citizen/10',      text: 'text-citizen',     dot: 'bg-citizen'     },
  servicios:  { bg: 'bg-gold/10',         text: 'text-gold',        dot: 'bg-gold'        },
  tendencia:  { bg: 'bg-emerald/10',      text: 'text-emerald',     dot: 'bg-emerald'     },
  destacado:  { bg: 'bg-gold/15',         text: 'text-gold',        dot: 'bg-gold'        },
  resuelto:   { bg: 'bg-emerald/10',      text: 'text-emerald',     dot: 'bg-emerald'     },
  pendiente:  { bg: 'bg-citizen/10',      text: 'text-citizen',     dot: 'bg-citizen'     },
  activo:     { bg: 'bg-azure/10',        text: 'text-azure',       dot: 'bg-azure'       },
  default:    { bg: 'bg-white/5',         text: 'text-secondary',   dot: 'bg-secondary'   },
}

const TAG_LABELS: Record<string, string> = {
  ambiente:   'Ambiente',
  social:     'Social',
  urgente:    'Urgente',
  nuevo:      'Nuevo',
  servicios:  'Servicios',
  tendencia:  'Tendencia',
  destacado:  'Destacado',
  resuelto:   'Resuelto',
  pendiente:  'Pendiente',
  activo:     'Activo',
}

export function CategoryTag({ variant, label, size = 'sm' }: CategoryTagProps) {
  const styles = TAG_STYLES[variant] ?? TAG_STYLES.default
  const text   = label ?? TAG_LABELS[variant] ?? variant

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-sm font-mono uppercase tracking-[0.15em]',
        styles.bg,
        styles.text,
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
      ].join(' ')}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
      {text}
    </span>
  )
}

'use client'

// ── Sistema Gráfico de Medición Estadística — Sistema 3
// KPI card con valor principal, delta de tendencia, y sparkline.

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MiniSpark } from './MiniSpark'

interface KpiCardProps {
  label: string
  value: string | number | null
  delta?: number            // % cambio: +8.3 o -2.1
  deltaLabel?: string       // "este mes", "vs semana anterior"
  sparkData?: number[]      // 8 puntos para sparkline
  color?: string            // color hex para sparkline y acento
  loading?: boolean
  unit?: string             // sufijo: "pts", "activos", etc.
  icon?: React.ReactNode
}

function DeltaBadge({ delta, label }: { delta: number; label?: string }) {
  const positive = delta > 0
  const neutral  = delta === 0
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown
  const colorClass = neutral
    ? 'text-secondary bg-white/4'
    : positive
      ? 'text-emerald bg-emerald/10'
      : 'text-red bg-red/10'
  const sign = positive ? '+' : ''

  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${colorClass}`}>
      <Icon size={9} strokeWidth={2.5} />
      {sign}{Math.abs(delta).toFixed(1)}%
      {label && <span className="text-[8px] opacity-70 ml-0.5">{label}</span>}
    </span>
  )
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  sparkData,
  color = '#C8A84B',
  loading = false,
  unit,
  icon,
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-3 border border-border bg-surface p-5 transition-colors hover:border-border-active">
      {/* Top row: icon + label */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary">
          {label}
        </span>
        {icon && (
          <span className="text-tertiary">{icon}</span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          {loading || value === null ? (
            <div className="h-9 w-20 animate-pulse rounded bg-white/4" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-display text-3xl font-bold leading-none"
                style={{ color }}
              >
                {value}
              </span>
              {unit && (
                <span className="font-mono text-[10px] text-tertiary">{unit}</span>
              )}
            </div>
          )}
          {delta !== undefined && !loading && value !== null && (
            <div className="mt-2">
              <DeltaBadge delta={delta} label={deltaLabel} />
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparkData && !loading && (
          <div className="flex-shrink-0 opacity-70">
            <MiniSpark data={sparkData} color={color} width={72} height={32} />
          </div>
        )}
      </div>
    </div>
  )
}

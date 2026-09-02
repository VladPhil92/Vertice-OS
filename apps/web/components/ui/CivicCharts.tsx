'use client'

interface DonutSegment {
  label: string
  value: number
  color: string
}

interface CivicDonutProps {
  value: number
  label?: string
  segments: DonutSegment[]
  size?: number
}

interface TrendPoint {
  label: string
  value: number
}

interface CivicTrendChartProps {
  points: TrendPoint[]
  emptyLabel?: string
}

interface CivicBarDatum {
  label: string
  value: number
  total: number
  color: string
  meta?: string
}

interface CivicBarListProps {
  data: CivicBarDatum[]
}

export function CivicDonut({ value, label = 'Puntos', segments, size = 184 }: CivicDonutProps) {
  const positiveSegments = segments.filter((segment) => segment.value > 0)
  const total = positiveSegments.reduce((sum, segment) => sum + segment.value, 0)
  let cursor = 0
  const stops = positiveSegments.map((segment) => {
    const start = total > 0 ? (cursor / total) * 100 : 0
    cursor += segment.value
    const end = total > 0 ? (cursor / total) * 100 : 0
    return `${segment.color} ${start}% ${end}%`
  })

  const background = stops.length > 0
    ? `conic-gradient(${stops.join(', ')})`
    : 'conic-gradient(#E9EDF3 0% 100%)'

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background }}
      role="img"
      aria-label={`${value.toLocaleString('es-CO')} ${label.toLowerCase()}`}
    >
      <div className="absolute inset-[15px] rounded-full bg-white shadow-[inset_0_0_0_1px_#E1E7EF]" />
      <div className="relative z-10 text-center">
        <div className="font-display text-4xl font-extrabold tracking-[-0.04em] text-[#0A2A66]">
          {value.toLocaleString('es-CO')}
        </div>
        <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7B8799]">
          {label}
        </div>
      </div>
    </div>
  )
}

export function CivicTrendChart({ points, emptyLabel = 'Sin historial suficiente' }: CivicTrendChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[#D8E0EA] bg-[#F8FAFC] px-6 text-center text-xs font-semibold text-[#7B8799]">
        {emptyLabel}
      </div>
    )
  }

  const width = 560
  const height = 190
  const padding = { top: 18, right: 18, bottom: 36, left: 42 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const values = points.map((point) => point.value)
  const maxValue = Math.max(10, ...values)
  const minValue = Math.min(0, ...values)
  const range = Math.max(1, maxValue - minValue)

  const coords = points.map((point, index) => {
    const x = padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
    const y = padding.top + plotHeight - ((point.value - minValue) / range) * plotHeight
    return { ...point, x, y }
  })

  const line = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const area = [
    `${coords[0].x},${padding.top + plotHeight}`,
    ...coords.map((point) => `${point.x},${point.y}`),
    `${coords[coords.length - 1].x},${padding.top + plotHeight}`,
  ].join(' ')

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E1E7EF] bg-white p-3 sm:p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Evolución de puntuación cívica">
        <defs>
          <linearGradient id="civicTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A90E2" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#4A90E2" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + ratio * plotHeight
          const value = Math.round(maxValue - ratio * range)
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#E9EDF3" strokeWidth="1" />
              <text x={padding.left - 9} y={y + 3} textAnchor="end" fontSize="9" fill="#8A96A7">
                {value}
              </text>
            </g>
          )
        })}

        <polygon points={area} fill="url(#civicTrendArea)" />
        <polyline points={line} fill="none" stroke="#0A2A66" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {coords.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#F5B700" stroke="#FFFFFF" strokeWidth="2" />
            <text x={point.x} y={height - 11} textAnchor="middle" fontSize="9" fill="#6A768A">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function CivicBarList({ data }: CivicBarListProps) {
  return (
    <div className="space-y-4">
      {data.map((item) => {
        const pct = item.total > 0 ? Math.min(100, Math.max(0, (item.value / item.total) * 100)) : 0
        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-xs font-bold text-[#0A2A66]">{item.label}</span>
              <span className="text-[10px] font-semibold text-[#6A768A]">
                {item.meta ?? item.value.toLocaleString('es-CO')}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#E9EDF3]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

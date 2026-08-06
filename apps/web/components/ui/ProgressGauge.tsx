'use client'

// ── Sistema Gráfico de Medición Estadística — Sistema 3
// Gauge circular SVG con animación de relleno.

interface ProgressGaugeProps {
  value: number          // 0–100
  size?: number          // px
  strokeWidth?: number
  label?: string
  sublabel?: string
  showValue?: boolean
}

function gaugeColor(v: number): string {
  if (v >= 75) return '#27AE60'   // emerald — bueno
  if (v >= 40) return '#C8A84B'   // gold — medio
  return '#C0392B'                // red — bajo
}

export function ProgressGauge({
  value,
  size = 100,
  strokeWidth = 8,
  label,
  sublabel,
  showValue = true,
}: ProgressGaugeProps) {
  const cx = size / 2
  const cy = size / 2
  const r  = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  // Gauge de 270° (3/4 del círculo) — más visual que 360°
  const arcLen   = circumference * 0.75
  const offset   = arcLen - (Math.min(value, 100) / 100) * arcLen
  const color    = gaugeColor(value)

  // Rotar para que empiece a las 7 en punto (135°) y termine a las 5 en punto (45°)
  const rotation = 135

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-label={`${value}%`}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLen} ${circumference - arcLen}`}
            strokeLinecap="round"
          />
          {/* Fill */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLen - offset} ${circumference - (arcLen - offset)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ transform: 'rotate(0deg)' }}
          >
            <span
              className="font-display font-bold leading-none"
              style={{ fontSize: size * 0.22, color }}
            >
              {Math.round(value)}
              <span className="text-[0.55em] opacity-70">%</span>
            </span>
          </div>
        )}
      </div>

      {label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary text-center">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="font-mono text-[9px] text-tertiary/60 text-center">{sublabel}</span>
      )}
    </div>
  )
}

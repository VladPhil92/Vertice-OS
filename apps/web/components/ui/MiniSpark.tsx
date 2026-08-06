'use client'

// ── Sistema Gráfico de Medición Estadística — Sistema 3
// Sparkline SVG pura, sin dependencias de charting.

interface MiniSparkProps {
  data: number[]
  color?: string      // hex o css var
  fill?: boolean      // mostrar área bajo la línea
  width?: number
  height?: number
  className?: string
}

export function MiniSpark({
  data,
  color = '#C8A84B',
  fill = true,
  width = 72,
  height = 28,
  className,
}: MiniSparkProps) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pad = 2

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y] as [number, number]
  })

  const polylinePoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  // Área de relleno: desde el primer punto hasta el último, bajando al fondo
  const areaPoints = [
    `${points[0][0].toFixed(1)},${(height - pad).toFixed(1)}`,
    ...points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`),
    `${points[points.length - 1][0].toFixed(1)},${(height - pad).toFixed(1)}`,
  ].join(' ')

  const gradId = `spark-grad-${color.replace('#', '')}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {fill && (
        <polygon
          points={areaPoints}
          fill={`url(#${gradId})`}
        />
      )}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Dot en el último valor */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2}
        fill={color}
      />
    </svg>
  )
}

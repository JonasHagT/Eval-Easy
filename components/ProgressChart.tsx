'use client'

export interface ChartDataPoint {
  label: string
  passRate: number
  model: string
  mode?: string
}

interface Props {
  data: ChartDataPoint[]
}

const MODEL_COLOR: Record<string, string> = {
  'claude-sonnet-4-6': '#6366f1',
  'claude-opus-4-8': '#a855f7',
  'claude-haiku-4-5-20251001': '#22d3ee',
}

const MODEL_LABEL: Record<string, string> = {
  'claude-sonnet-4-6': 'Sonnet',
  'claude-opus-4-8': 'Opus',
  'claude-haiku-4-5-20251001': 'Haiku',
}

const PAD = { top: 28, right: 24, bottom: 56, left: 48 }
const W = 600
const H = 200

function getColor(model: string) {
  return MODEL_COLOR[model] ?? '#94a3b8'
}

export default function ProgressChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-gray-600">
        No runs yet — start a batch run to see progress here.
      </div>
    )
  }

  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW / 2
  const points = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? i * xStep : chartW / 2),
    y: PAD.top + chartH - (d.passRate / 100) * chartH,
    ...d,
  }))

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const areaPoints = [
    `${points[0].x},${PAD.top + chartH}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${PAD.top + chartH}`,
  ].join(' ')

  const gridLines = [0, 25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      {/* Grid lines */}
      {gridLines.map(pct => {
        const y = PAD.top + chartH - (pct / 100) * chartH
        return (
          <g key={pct}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="#1f2937"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#4b5563"
            >
              {pct}%
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      {data.length > 1 && (
        <polygon points={areaPoints} fill="#6366f1" fillOpacity={0.08} />
      )}

      {/* Connecting line */}
      {data.length > 1 && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      )}

      {/* Dots and labels */}
      {points.map((p, i) => {
        const color = getColor(p.model)
        const labelY = p.y - 10
        const runLabel = p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label
        return (
          <g key={i}>
            {/* Pass rate label above dot */}
            <text
              x={p.x}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fontWeight="600"
              fill={color}
            >
              {Math.round(p.passRate)}%
            </text>
            {/* Dot */}
            <circle cx={p.x} cy={p.y} r={6} fill={color} />
            <circle cx={p.x} cy={p.y} r={3} fill="white" fillOpacity={0.9} />
            {/* Run name below x-axis */}
            <text
              x={p.x}
              y={PAD.top + chartH + 16}
              textAnchor="middle"
              fontSize={9}
              fill="#6b7280"
            >
              {runLabel}
            </text>
            {/* Model label */}
            <text
              x={p.x}
              y={PAD.top + chartH + 28}
              textAnchor="middle"
              fontSize={8}
              fill={color}
              fillOpacity={0.8}
            >
              {MODEL_LABEL[p.model] ?? p.model.split('-')[1] ?? p.model}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

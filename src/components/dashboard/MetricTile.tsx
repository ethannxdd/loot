import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCurrency } from '@/lib/utils'

interface MetricTileProps {
  label: string
  icon: LucideIcon
  /** CSS colour for the icon + sparkline, e.g. 'var(--chart-2)'. */
  color: string
  value: number
  delta: number | null
  /** True when a rise is bad news (spending). */
  invertDelta?: boolean
  sparkline: number[]
  /** Shown instead of the delta line when there's no comparison yet. */
  fallbackNote?: ReactNode
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 110
  const h = 36
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * (w - 4) + 2},${h - 4 - ((v - min) / span) * (h - 8)}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Compact metric card (v2): icon label, big number, sparkline, and a plain-language delta. */
export function MetricTile({ label, icon: Icon, color, value, delta, invertDelta, sparkline, fallbackNote }: MetricTileProps) {
  const up = (delta ?? 0) >= 0
  const good = invertDelta ? !up : up
  const same = delta !== null && Math.round(delta) === 0

  return (
    <section className="card flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          <Icon size={15} strokeWidth={2.1} />
        </span>
        {label}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <p className="tnum text-[22px] font-bold tracking-[-0.03em] sm:text-[28px]">{formatCurrency(value)}</p>
        <span className="hidden xl:block">
          <Sparkline data={sparkline} color={color} />
        </span>
      </div>
      {delta === null ? (
        <span className="text-[12.5px] font-medium text-muted-foreground">{fallbackNote}</span>
      ) : same ? (
        <span className="text-[12.5px] font-medium text-muted-foreground">Same as last month</span>
      ) : (
        <span className={`inline-flex items-center gap-1 text-[12.5px] font-semibold ${good ? 'text-primary' : 'text-alert'}`}>
          {up ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
          {formatCurrency(Math.abs(delta))} {up ? 'more' : 'less'}
          <span className="hidden sm:inline"> than last month</span>
        </span>
      )}
    </section>
  )
}

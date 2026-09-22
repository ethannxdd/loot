import { TrendingDown, TrendingUp } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number
  sparkline: number[]
  delta: number | null
  /** When true, a positive delta is shown in the alert colour instead of primary (e.g. "going out"). */
  invertDeltaColor?: boolean
  color?: string
  /** "card" (default) is the original vertical tile. "chip" is a compact horizontal row, used
   *  alongside the AvailableLootHero on Dashboard now that "Available loot" gets its own hero. */
  variant?: 'card' | 'chip'
}

export function StatCard({
  label,
  value,
  sparkline,
  delta,
  invertDeltaColor = false,
  color = '#C1FE72',
  variant = 'card',
}: StatCardProps) {
  const data = sparkline.map((v, i) => ({ i, v }))
  const isPositive = (delta ?? 0) >= 0
  const deltaIsGood = invertDeltaColor ? !isPositive : isPositive

  const deltaBadge = delta !== null && (
    <span
      className={`flex items-center gap-1 text-xs font-semibold ${deltaIsGood ? 'text-primary' : 'text-alert'}`}
    >
      {isPositive ? <TrendingUp size={13} strokeWidth={2} /> : <TrendingDown size={13} strokeWidth={2} />}
      {formatCurrency(Math.abs(delta))}
      {variant === 'card' && ' vs last month'}
    </span>
  )

  const chart = data.length > 1 && (
    <div className={variant === 'chip' ? 'h-7 w-16 shrink-0' : 'h-8 w-20 shrink-0'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )

  if (variant === 'chip') {
    return (
      <div className="card flex items-center gap-4 !py-4">
        <div className="min-w-0">
          <div className="overline-label">{label}</div>
          <p className="financial-number tnum mt-1 text-xl">{formatCurrency(value)}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {deltaBadge}
          {chart}
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="overline-label">{label}</div>
      <p className="financial-number tnum text-[26px]">{formatCurrency(value)}</p>
      <div className="flex items-center justify-between gap-3">
        {deltaBadge}
        {chart}
      </div>
    </div>
  )
}

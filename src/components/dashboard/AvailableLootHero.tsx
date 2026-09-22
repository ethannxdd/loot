import { TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface AvailableLootHeroProps {
  value: number
  delta: number | null
  sparkline: number[]
}

/**
 * The Dashboard's hero surface — "Available loot" gets a full-width, oversized treatment
 * (gradient-clipped number + a chart bleeding along the bottom edge) instead of sitting as one
 * of three equal stat tiles. See LOOT-DESIGN-SYSTEM.md § Hero.
 */
export function AvailableLootHero({ value, delta, sparkline }: AvailableLootHeroProps) {
  const data = sparkline.map((v, i) => ({ i, v }))
  const isPositive = (delta ?? 0) >= 0

  return (
    <div className="hero-card">
      <div className="flex flex-col gap-2 p-7 pb-0 sm:p-9 sm:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="overline">Available loot</div>
          {delta !== null && (
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                isPositive ? 'bg-primary/15 text-primary' : 'bg-alert/15 text-alert'
              }`}
            >
              {isPositive ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
              {formatCurrency(Math.abs(delta))} vs last month
            </span>
          )}
        </div>
        <p className="hero-number tnum">{formatCurrency(value)}</p>
      </div>

      {data.length > 1 && (
        <div className="mt-3 h-24 sm:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C1FE72" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#C1FE72" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#C1FE72"
                strokeWidth={2.5}
                fill="url(#heroFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

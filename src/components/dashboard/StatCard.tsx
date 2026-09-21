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
}

export function StatCard({
  label,
  value,
  sparkline,
  delta,
  invertDeltaColor = false,
  color = '#C1FE72',
}: StatCardProps) {
  const data = sparkline.map((v, i) => ({ i, v }))
  const isPositive = (delta ?? 0) >= 0
  const deltaIsGood = invertDeltaColor ? !isPositive : isPositive

  return (
    <div className="card space-y-3">
      <div className="overline">{label}</div>
      <p className="financial-number tnum text-[26px]">{formatCurrency(value)}</p>
      <div className="flex items-center justify-between gap-3">
        {delta !== null && (
          <span
            className={`flex items-center gap-1 text-xs font-semibold ${
              deltaIsGood ? 'text-primary' : 'text-alert'
            }`}
          >
            {isPositive ? (
              <TrendingUp size={13} strokeWidth={2} />
            ) : (
              <TrendingDown size={13} strokeWidth={2} />
            )}
            {formatCurrency(Math.abs(delta))} vs last month
          </span>
        )}
        {data.length > 1 && (
          <div className="h-8 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

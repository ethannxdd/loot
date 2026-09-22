import { categoryChartToken, categoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/utils'

const CHART_COLORS: Record<string, string> = {
  'chart-1': '#AF72FE',
  'chart-2': '#C1FE72',
  'chart-3': '#5BC0EB',
  'chart-4': '#F0A857',
  'chart-5': '#FF7F7F',
}

interface DistributionChartProps {
  categoryTotals: Record<string, number>
}

export function DistributionChart({ categoryTotals }: DistributionChartProps) {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1

  if (entries.length === 0) return null

  return (
    <div className="card space-y-3">
      <p className="overline-label">Spending distribution</p>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/5">
        {entries.map(([category, amount]) => (
          <div
            key={category}
            style={{
              width: `${(amount / total) * 100}%`,
              background: CHART_COLORS[categoryChartToken(category)],
            }}
            title={`${categoryLabel(category)}: ${formatCurrency(amount)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {entries.slice(0, 8).map(([category, amount]) => (
          <div key={category} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: CHART_COLORS[categoryChartToken(category)] }}
            />
            {categoryLabel(category)} · {((amount / total) * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}

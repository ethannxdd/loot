import { categoryColor, categoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/utils'

interface DistributionChartProps {
  categoryTotals: Record<string, number>
}

/** One stacked bar of the statement's spend, coloured by category family. */
export function DistributionChart({ categoryTotals }: DistributionChartProps) {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1

  if (entries.length === 0) return null

  return (
    <div className="card space-y-3">
      <h3 className="card-title">Spending mix</h3>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
        {entries.map(([category, amount]) => (
          <div
            key={category}
            style={{ width: `${(amount / total) * 100}%`, background: categoryColor(category) }}
            title={`${categoryLabel(category)}: ${formatCurrency(amount)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {entries.slice(0, 8).map(([category, amount]) => (
          <div key={category} className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: categoryColor(category) }} />
            {categoryLabel(category)} · {((amount / total) * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}

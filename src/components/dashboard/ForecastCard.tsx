import { TrendingUp, TriangleAlert } from 'lucide-react'
import { categoryLabel } from '@/lib/categories'
import { computeForecast } from '@/lib/forecast'
import type { Expense, MonthlySnapshot } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

const CONFIDENCE_META = {
  high: { label: 'High confidence', className: 'text-primary bg-primary/10 border-primary/30' },
  medium: { label: 'Medium confidence', className: 'text-caution bg-caution/10 border-caution/30' },
  low: { label: 'Low confidence', className: 'text-text-muted bg-white/5 border-border' },
}

interface ForecastCardProps {
  snapshots: MonthlySnapshot[]
  expenses: Expense[]
  netIncome: number
}

export function ForecastCard({ snapshots, expenses, netIncome }: ForecastCardProps) {
  const forecast = computeForecast(snapshots, expenses, netIncome)
  const confidence = CONFIDENCE_META[forecast.confidence]

  const topCategories = Object.entries(forecast.projectedExpensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="overline flex items-center gap-1.5">
          <TrendingUp size={13} strokeWidth={2} /> Forecast
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${confidence.className}`}>
          {confidence.label}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">Projected position at month end, based on recent history.</p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-text-muted">Income</p>
          <p className="tnum text-sm font-bold">{formatCurrency(forecast.projectedIncome)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Expenses</p>
          <p className="tnum text-sm font-bold">{formatCurrency(forecast.projectedTotalExpenses)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Disposable</p>
          <p className={`tnum text-sm font-bold ${forecast.projectedDisposableIncome < 0 ? 'text-alert' : 'text-primary'}`}>
            {formatCurrency(forecast.projectedDisposableIncome)}
          </p>
        </div>
      </div>

      {topCategories.length > 0 && (
        <div className="space-y-1.5 border-t border-hairline pt-3">
          {topCategories.map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{categoryLabel(category)}</span>
              <span className="tnum font-medium">{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      )}

      {forecast.flaggedCategories.length > 0 && (
        <div className="space-y-1.5 border-t border-hairline pt-3">
          {forecast.flaggedCategories.slice(0, 3).map((f) => (
            <div key={f.category} className="flex items-start gap-1.5 text-xs">
              <TriangleAlert size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-caution" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{categoryLabel(f.category)}</span> is tracking{' '}
                {Math.round(f.pctAboveAverage)}% above its 3-month average.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

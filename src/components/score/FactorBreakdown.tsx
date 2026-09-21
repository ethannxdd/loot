import { scoreColor } from '@/lib/budge-score'
import type { ScoreFactors } from '@/lib/types'

const FACTOR_META: Record<keyof ScoreFactors, { label: string; weight: string }> = {
  dti: { label: 'Debt-to-income', weight: '30%' },
  payment_consistency: { label: 'Payment consistency', weight: '25%' },
  savings_rate: { label: 'Savings rate', weight: '20%' },
  utilisation: { label: 'Credit utilisation', weight: '15%' },
  expense_consistency: { label: 'Spending consistency', weight: '10%' },
}

const BAR_COLOR: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-primary',
  amber: 'bg-caution',
  red: 'bg-alert',
}

const FACTOR_ORDER: (keyof ScoreFactors)[] = [
  'dti',
  'payment_consistency',
  'savings_rate',
  'utilisation',
  'expense_consistency',
]

export function FactorBreakdown({ factors }: { factors: ScoreFactors }) {
  return (
    <div className="space-y-3">
      {FACTOR_ORDER.map((key) => {
        const value = factors[key]
        const meta = FACTOR_META[key]
        const color = scoreColor(value)
        return (
          <div key={key}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium">
                {meta.label} <span className="text-text-muted">· {meta.weight}</span>
              </span>
              <span className="tnum font-semibold">{Math.round(value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full ${BAR_COLOR[color]}`}
                style={{ width: `${Math.min(100, (value / 999) * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

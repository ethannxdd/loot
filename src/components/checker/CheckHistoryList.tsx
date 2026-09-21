import { VERDICT_META } from '@/lib/verdict'
import { formatCurrency } from '@/lib/utils'
import type { AffordabilityCheck } from '@/lib/types'

export function CheckHistoryList({ checks }: { checks: AffordabilityCheck[] }) {
  if (checks.length === 0) return null
  return (
    <div className="card space-y-1">
      {checks.map((check) => {
        const meta = VERDICT_META[check.verdict]
        return (
          <div key={check.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{check.item_name}</p>
              <p className="truncate text-xs text-text-muted">{check.reasoning}</p>
            </div>
            <div className="tnum shrink-0 text-right text-sm">{formatCurrency(check.amount)}</div>
            <span className={`shrink-0 text-xs font-semibold ${meta.colorClass}`}>{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}

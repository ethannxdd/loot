import { Trash2 } from 'lucide-react'
import { useDeleteAffordabilityCheck } from '@/hooks/useAffordabilityChecks'
import { VERDICT_META } from '@/lib/verdict'
import { formatCurrencyExact } from '@/lib/utils'
import type { AffordabilityCheck } from '@/lib/types'

export function CheckHistoryList({ checks }: { checks: AffordabilityCheck[] }) {
  const remove = useDeleteAffordabilityCheck()
  if (checks.length === 0) return null
  return (
    <div className="card space-y-1">
      {checks.map((check) => {
        const meta = VERDICT_META[check.verdict]
        return (
          <div key={check.id} className="group flex items-center gap-3 rounded-[10px] px-2 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {check.item_name}
                {check.is_recurring && <span className="ml-1.5 text-xs font-normal text-text-muted">monthly</span>}
              </p>
              <p className="truncate text-xs text-text-muted" title={check.reasoning}>
                {check.reasoning}
              </p>
            </div>
            <div className="tnum shrink-0 text-right text-sm">
              {formatCurrencyExact(check.amount, check.currency_code)}
            </div>
            <span className={`shrink-0 text-xs font-semibold ${meta.colorClass}`}>{meta.label}</span>
            <button
              type="button"
              onClick={() => remove.mutate(check.id)}
              disabled={remove.isPending}
              aria-label={`Delete check for ${check.item_name}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-100 hover:bg-white/10 hover:text-alert md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

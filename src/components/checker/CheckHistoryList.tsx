import { Trash2 } from 'lucide-react'
import { useDeleteAffordabilityCheck } from '@/hooks/useAffordabilityChecks'
import { VERDICT_META } from '@/lib/verdict'
import { formatCurrencyExact } from '@/lib/utils'
import type { AffordabilityCheck } from '@/lib/types'

const TINT = { comfortable: 'bg-primary/12', tight: 'bg-caution/14', 'not-recommended': 'bg-alert/12' } as const

export function CheckHistoryList({ checks }: { checks: AffordabilityCheck[] }) {
  const remove = useDeleteAffordabilityCheck()
  if (checks.length === 0) return null
  return (
    <div className="card !px-4 !py-2">
      <div className="divide-y divide-hairline">
      {checks.map((check) => {
        const meta = VERDICT_META[check.verdict]
        const Icon = meta.icon
        return (
          <div key={check.id} className="group flex items-center gap-3 py-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.colorClass} ${TINT[check.verdict]}`}>
              <Icon size={17} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">
                {check.item_name}
                {check.is_recurring && <span className="ml-1.5 text-[12.5px] font-medium text-text-subtle">monthly</span>}
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground" title={check.reasoning}>
                {check.reasoning}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-[15px] font-semibold">{formatCurrencyExact(check.amount, check.currency_code)}</p>
              <p className={`text-[12px] font-semibold ${meta.colorClass}`}>{meta.label}</p>
            </div>
            <button
              type="button"
              onClick={() => remove.mutate(check.id)}
              disabled={remove.isPending}
              aria-label={`Delete check for ${check.item_name}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-subtle opacity-100 hover:bg-fill hover:text-alert md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        )
      })}
      </div>
    </div>
  )
}

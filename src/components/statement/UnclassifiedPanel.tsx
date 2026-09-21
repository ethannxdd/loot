import { HelpCircle } from 'lucide-react'
import { useMemo } from 'react'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/categories'
import { merchantKey } from '@/lib/statement'
import { formatCurrency } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/types'

interface UnclassifiedPanelProps {
  transactions: ParsedTransaction[]
  onAssign: (merchant: string, category: ExpenseCategory) => void
}

interface MerchantGroup {
  key: string
  label: string
  count: number
  total: number
  sample: string
}

/**
 * Spending Loot couldn't put in a category. Grouped by merchant so one choice fixes every matching line —
 * and is remembered on this device for future statements.
 */
export function UnclassifiedPanel({ transactions, onAssign }: UnclassifiedPanelProps) {
  const groups = useMemo(() => {
    const map = new Map<string, MerchantGroup>()
    for (const t of transactions) {
      const key = merchantKey(t.description)
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
        existing.total += Math.abs(t.amount)
      } else {
        map.set(key, { key, label: key || t.description, count: 1, total: Math.abs(t.amount), sample: t.description })
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [transactions])

  if (groups.length === 0) return null

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <HelpCircle size={16} strokeWidth={1.75} className="text-caution" />
        <p className="text-sm font-bold">Needs a category</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Pick a category for each merchant below. Loot remembers your choice on this device, so next month's statement
        sorts itself.
      </p>
      <div className="space-y-2">
        {groups.slice(0, 25).map((g) => (
          <div key={g.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-2 px-3.5 py-2.5">
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-sm font-semibold capitalize" title={g.sample}>
                {g.label}
              </p>
              <p className="tnum text-xs text-text-muted">
                {formatCurrency(g.total)} · {g.count} transaction{g.count === 1 ? '' : 's'}
              </p>
            </div>
            <select
              aria-label={`Category for ${g.label}`}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) onAssign(g.sample, e.target.value as ExpenseCategory)
              }}
              className="!w-auto min-w-40 !py-1.5 text-xs"
            >
              <option value="" disabled>
                Choose category…
              </option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {groups.length > 25 && (
          <p className="px-1 text-xs text-text-muted">…and {groups.length - 25} smaller merchants.</p>
        )}
      </div>
    </div>
  )
}

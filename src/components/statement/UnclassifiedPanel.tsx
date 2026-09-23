import { HelpCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Select } from '@/components/ui/Select'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/categories'
import { merchantKey } from '@/lib/statement'
import { formatCurrency } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/types'

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))

/** Its own tiny component so each row keeps its own picked-value state (the select is a
 *  controlled component now, unlike the native <select defaultValue> this replaces). */
function CategorySelect({ label, onAssign }: { label: string; onAssign: (category: ExpenseCategory) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="w-full min-w-40 sm:w-52">
      <Select
        value={value}
        onValueChange={(v) => {
          setValue(v)
          onAssign(v as ExpenseCategory)
        }}
        placeholder="Choose category…"
        aria-label={`Category for ${label}`}
        options={CATEGORY_OPTIONS}
      />
    </div>
  )
}

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
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-caution/14 text-caution">
          <HelpCircle size={16} strokeWidth={2} />
        </span>
        <h3 className="card-title">Needs a category</h3>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Pick a category for each merchant below. Loot remembers your choice on this device, so next month's statement
        sorts itself.
      </p>
      <div className="space-y-2">
        {groups.slice(0, 25).map((g) => (
          <div key={g.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface-2 px-3.5 py-2.5">
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-[14px] font-semibold capitalize" title={g.sample}>
                {g.label}
              </p>
              <p className="tnum text-[12.5px] text-muted-foreground">
                {formatCurrency(g.total)} · {g.count} transaction{g.count === 1 ? '' : 's'}
              </p>
            </div>
            <CategorySelect label={g.label} onAssign={(c) => onAssign(g.sample, c)} />
          </div>
        ))}
        {groups.length > 25 && (
          <p className="px-1 text-xs text-text-muted">…and {groups.length - 25} smaller merchants.</p>
        )}
      </div>
    </div>
  )
}

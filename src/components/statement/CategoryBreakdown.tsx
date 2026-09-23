import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { categoryColor, categoryIcon, categoryLabel, type ExpenseCategory } from '@/lib/categories'
import { formatCurrency } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/types'

interface CategoryBreakdownProps {
  categoryTotals: Record<string, number>
  transactions: ParsedTransaction[]
}

export function CategoryBreakdown({ categoryTotals, transactions }: CategoryBreakdownProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1

  if (entries.length === 0) {
    return <p className="card py-8 text-center text-[14px] text-muted-foreground">No classified spending found.</p>
  }

  return (
    <div className="card !pb-3">
      <h3 className="card-title mb-2">By category</h3>
      <div className="divide-y divide-hairline">
      {entries.map(([category, amount]) => {
        const Icon = categoryIcon(category as ExpenseCategory)
        const isOpen = expanded === category
        const items = transactions.filter((t) => t.category === category && t.amount < 0)
        return (
          <div key={category}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : category)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <div
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] text-white"
                style={{ background: categoryColor(category) }}
              >
                <Icon size={15} strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold">{categoryLabel(category as ExpenseCategory)}</span>
                  <span className="tnum text-[14px] font-semibold">{formatCurrency(amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-fill">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (amount / total) * 100)}%`, background: categoryColor(category) }}
                  />
                </div>
              </div>
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className={`shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && (
              <div className="animate-enter mb-3 ml-[42px] space-y-1.5 rounded-xl bg-surface-2 p-3">
                {items.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-[12.5px] text-muted-foreground">
                    <span className="truncate pr-2">
                      {t.date} · {t.description}
                    </span>
                    <span className="tnum shrink-0">{formatCurrency(Math.abs(t.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

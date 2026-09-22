import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { categoryIcon, categoryLabel, type ExpenseCategory } from '@/lib/categories'
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
    return <p className="card py-8 text-center text-sm text-text-muted">No classified spending found.</p>
  }

  return (
    <div className="card space-y-2">
      <p className="overline-label">Category breakdown</p>
      {entries.map(([category, amount]) => {
        const Icon = categoryIcon(category as ExpenseCategory)
        const isOpen = expanded === category
        const items = transactions.filter((t) => t.category === category && t.amount < 0)
        return (
          <div key={category} className="rounded-lg bg-surface-2">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : category)}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Icon size={15} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{categoryLabel(category as ExpenseCategory)}</span>
                  <span className="tnum text-sm">{formatCurrency(amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${Math.min(100, (amount / total) * 100)}%` }}
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
              <div className="space-y-1 px-3.5 pb-3">
                {items.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
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
  )
}

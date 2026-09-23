import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { categoryColor, categoryIcon, categoryLabel } from '@/lib/categories'
import { formatCurrencyExact } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const FREQ: Record<string, string> = { monthly: '/mo', weekly: '/wk', annual: '/yr', 'once-off': ' once' }

function addedLabel(iso: string) {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Added today'
  if (days === 1) return 'Added yesterday'
  if (days < 7) return `Added ${d.toLocaleDateString('en-ZA', { weekday: 'long' })}`
  return `Added ${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
}

/** The five most recently added expenses. */
export function RecentActivity({ expenses }: { expenses: Expense[] }) {
  const recent = expenses
    .filter((e) => !e.deleted_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  if (recent.length === 0) return null

  return (
    <section className="card h-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="card-title">Recently added</h3>
        <Link to="/expenses" className="inline-flex items-center text-[13px] font-semibold text-primary">
          See all <ChevronRight size={15} />
        </Link>
      </div>
      <ul className="divide-y divide-hairline">
        {recent.map((expense) => {
          const Icon = categoryIcon(expense.category)
          return (
            <li key={expense.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                className="grid h-[38px] w-[38px] place-items-center rounded-[11px] text-white"
                style={{ background: categoryColor(expense.category) }}
              >
                <Icon size={16} strokeWidth={2.1} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{expense.name}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {categoryLabel(expense.category)} · {addedLabel(expense.created_at)}
                </p>
              </div>
              <span className="tnum text-right text-[14px] font-semibold">
                {formatCurrencyExact(expense.amount)}
                <span className="font-medium text-text-subtle">{FREQ[expense.frequency] ?? ''}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

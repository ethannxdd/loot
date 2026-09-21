import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { categoryIcon, categoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export function RecentActivity({ expenses }: { expenses: Expense[] }) {
  const recent = expenses
    .filter((e) => !e.deleted_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  if (recent.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="overline px-1">Recent activity</div>
      <div className="card space-y-1">
        {recent.map((expense) => {
          const Icon = categoryIcon(expense.category)
          return (
            <div key={expense.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
                <Icon size={14} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{expense.name}</p>
                <p className="truncate text-xs text-text-muted">{categoryLabel(expense.category)}</p>
              </div>
              <span className="tnum shrink-0 text-sm">{formatCurrency(expense.amount)}</span>
            </div>
          )
        })}
      </div>
      <Link
        to="/expenses"
        className="card-gradient flex items-center justify-between px-5 py-4 text-sm font-bold text-primary-foreground"
      >
        View all expenses
        <ArrowUpRight size={16} strokeWidth={2} />
      </Link>
    </div>
  )
}

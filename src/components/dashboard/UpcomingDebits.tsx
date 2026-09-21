import { CalendarClock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

function daysUntilDue(dueDay: number, today = new Date()): number {
  const currentDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  if (dueDay >= currentDay) return dueDay - currentDay
  return daysInMonth - currentDay + dueDay
}

export function UpcomingDebits({ expenses }: { expenses: Expense[] }) {
  const upcoming = expenses
    .filter((e) => !e.deleted_at && e.due_day)
    .map((e) => ({ expense: e, days: daysUntilDue(e.due_day!) }))
    .filter((x) => x.days <= 7)
    .sort((a, b) => a.days - b.days)

  return (
    <div className="card space-y-3">
      <div className="overline">Upcoming debits</div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-text-muted">Nothing due in the next 7 days.</p>
      ) : (
        <ul className="space-y-2.5">
          {upcoming.map(({ expense, days }) => (
            <li key={expense.id} className="flex items-center gap-2.5 text-sm">
              <CalendarClock size={15} strokeWidth={1.75} className="shrink-0 text-caution" />
              <span className="min-w-0 flex-1 truncate">{expense.name}</span>
              <span className="shrink-0 text-xs text-text-muted">
                {days === 0 ? 'today' : `in ${days}d`}
              </span>
              <span className="tnum shrink-0 font-semibold">{formatCurrency(expense.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

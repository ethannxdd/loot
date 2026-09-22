import { CalendarClock } from 'lucide-react'
import { daysUntilNextDue } from '@/lib/money'
import { formatCurrencyExact } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const WINDOW_DAYS = 7

export function UpcomingDebits({ expenses }: { expenses: Expense[] }) {
  const upcoming = expenses
    // A "due day" only means something for bills that recur monthly.
    .filter((e) => !e.deleted_at && e.due_day && e.frequency === 'monthly')
    .map((e) => ({ expense: e, days: daysUntilNextDue(e.due_day!) }))
    .filter((x) => x.days <= WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)

  return (
    <div className="card space-y-3">
      <div className="overline-label">Upcoming debits</div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-text-muted">Nothing due in the next {WINDOW_DAYS} days.</p>
      ) : (
        <ul className="space-y-2.5">
          {upcoming.map(({ expense, days }) => (
            <li key={expense.id} className="flex items-center gap-2.5 text-sm">
              <CalendarClock size={15} strokeWidth={1.75} className="shrink-0 text-caution" />
              <span className="min-w-0 flex-1 truncate">{expense.name}</span>
              <span className="shrink-0 text-xs text-text-muted">
                {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`}
              </span>
              <span className="tnum shrink-0 font-semibold">{formatCurrencyExact(expense.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

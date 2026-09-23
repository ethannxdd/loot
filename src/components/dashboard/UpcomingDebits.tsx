import { daysUntilNextDue, nextDueDate } from '@/lib/money'
import { categoryLabel } from '@/lib/categories'
import { formatCurrency, formatCurrencyExact } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const WINDOW_DAYS = 7

function whenLabel(days: number, date: Date) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-ZA', { weekday: 'long' })
}

/** Calendar-tile list of monthly debits due in the next 7 days. */
export function UpcomingDebits({ expenses, limit }: { expenses: Expense[]; limit?: number }) {
  const upcoming = expenses
    // A "due day" only means something for bills that recur monthly.
    .filter((e) => !e.deleted_at && e.due_day && e.frequency === 'monthly')
    .map((e) => ({ expense: e, days: daysUntilNextDue(e.due_day!), date: nextDueDate(e.due_day!) }))
    .filter((x) => x.days <= WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)
  const shown = limit ? upcoming.slice(0, limit) : upcoming
  const total = upcoming.reduce((s, x) => s + x.expense.amount, 0)

  return (
    <section className="card flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="card-title">Coming up</h3>
        <span className="text-[13px] text-muted-foreground">Next {WINDOW_DAYS} days</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Nothing due in the next {WINDOW_DAYS} days. Add a due day to a monthly expense to see it here.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-hairline">
            {shown.map(({ expense, days, date }) => (
              <li key={expense.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 first:pt-0">
                <span className="w-10 overflow-hidden rounded-[10px] bg-surface-2 text-center ring-1 ring-hairline" aria-hidden="true">
                  <span className="block h-[13px] bg-[#ff3b30] text-[9px] font-bold uppercase leading-[13px] tracking-[0.06em] text-white">
                    {date.toLocaleDateString('en-ZA', { month: 'short' })}
                  </span>
                  <span className="tnum block text-[17px] font-semibold leading-[27px] tracking-[-0.02em]">{date.getDate()}</span>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{expense.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {categoryLabel(expense.category)} · {whenLabel(days, date)}
                  </p>
                </div>
                <span className="tnum text-[14px] font-semibold">{formatCurrencyExact(expense.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
              {upcoming.length} debit{upcoming.length === 1 ? '' : 's'} this week
              <b className="tnum text-[15px] text-foreground">{formatCurrency(total)}</b>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

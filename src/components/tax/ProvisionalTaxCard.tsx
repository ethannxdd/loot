import { CalendarClock } from 'lucide-react'
import { parseDateOnly } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import type { ProvisionalEstimate } from '@/lib/tax/tax-math'

export function ProvisionalTaxCard({ estimates }: { estimates: ProvisionalEstimate[] }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={18} strokeWidth={1.75} className="text-secondary" />
        <h3 className="text-base font-bold">Provisional tax</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {estimates.map((e) => (
          <div key={e.periodLabel} className="rounded-xl bg-surface-2 p-3.5">
            <p className="overline">{e.periodLabel}</p>
            <p className="tnum mt-1 text-lg">{formatCurrency(e.amountDue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Due {parseDateOnly(e.dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
              {e.daysUntilDue >= 0 ? `${e.daysUntilDue} days away` : `${Math.abs(e.daysUntilDue)} days overdue`}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-subtle">
        Estimates only. Any PAYE your employer already withheld is credited first; the rest is split between the two
        payments. Your real IRP6 is based on your estimated taxable income for the year.
      </p>
    </div>
  )
}

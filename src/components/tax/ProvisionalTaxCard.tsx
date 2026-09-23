import { parseDateOnly } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import type { ProvisionalEstimate } from '@/lib/tax/tax-math'

export function ProvisionalTaxCard({ estimates }: { estimates: ProvisionalEstimate[] }) {
  return (
    <div className="card space-y-4 sm:p-6">
      <h3 className="card-title">Provisional tax</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {estimates.map((e) => (
          <div key={e.periodLabel} className="rounded-2xl bg-surface-2 p-4">
            <p className="text-[13px] text-muted-foreground">{e.periodLabel}</p>
            <p className="tnum mt-1 text-[22px] font-bold tracking-[-0.02em]">{formatCurrency(e.amountDue)}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Due {parseDateOnly(e.dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
              {e.daysUntilDue >= 0 ? `${e.daysUntilDue} days away` : `${Math.abs(e.daysUntilDue)} days overdue`}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Estimates only. Any PAYE your employer already withheld is credited first; the rest is split between the two
        payments. Your real IRP6 is based on your estimated taxable income for the year.
      </p>
    </div>
  )
}

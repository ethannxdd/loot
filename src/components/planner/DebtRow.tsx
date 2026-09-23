import { CreditCard, Pencil, Trash2 } from 'lucide-react'
import { DEBT_ACCOUNT_TYPE_LABELS, type Debt } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface DebtRowProps {
  debt: Debt
  onEdit: () => void
  onDelete: () => void
}

export function DebtRow({ debt, onEdit, onDelete }: DebtRowProps) {
  return (
    <div className="group flex items-center justify-between gap-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--chart-5)] text-white">
        <CreditCard size={16} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{debt.name}</p>
        <p className="truncate text-[12.5px] text-muted-foreground">
          {DEBT_ACCOUNT_TYPE_LABELS[debt.account_type]} · {debt.interest_rate}% p.a. · min{' '}
          {formatCurrency(debt.min_payment)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="tnum text-[15px] font-semibold">{formatCurrency(debt.balance)}</span>
        <div className="flex transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${debt.name}`}
            className="grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-foreground"
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${debt.name}`}
            className="grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )
}

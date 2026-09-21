import { Pencil, Trash2 } from 'lucide-react'
import { DEBT_ACCOUNT_TYPE_LABELS, type Debt } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface DebtRowProps {
  debt: Debt
  onEdit: () => void
  onDelete: () => void
}

export function DebtRow({ debt, onEdit, onDelete }: DebtRowProps) {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3.5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{debt.name}</p>
        <p className="text-xs text-muted-foreground">
          {DEBT_ACCOUNT_TYPE_LABELS[debt.account_type]} · {debt.interest_rate}% p.a. · min{' '}
          {formatCurrency(debt.min_payment)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="tnum text-sm">{formatCurrency(debt.balance)}</span>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit debt"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-foreground"
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete debt"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )
}

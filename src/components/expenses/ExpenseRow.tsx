import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { categoryIcon, categoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface ExpenseRowProps {
  expense: Expense
  onEdit?: () => void
  onDelete?: () => void
  onRestore?: () => void
  isPending?: boolean
  /** Household mode: shows whose expense this is. */
  ownerLabel?: string
  /** Household mode: true for a partner's row — hides edit/delete since you can't write to it. */
  readOnly?: boolean
}

const FREQUENCY_SHORT: Record<string, string> = {
  monthly: '/mo',
  weekly: '/wk',
  annual: '/yr',
  'once-off': 'once-off',
}

export function ExpenseRow({ expense, onEdit, onDelete, onRestore, isPending, ownerLabel, readOnly }: ExpenseRowProps) {
  const Icon = categoryIcon(expense.category)
  const isDeleted = Boolean(expense.deleted_at)

  return (
    <div
      className={`group flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors ${
        isDeleted ? 'opacity-60' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{expense.name}</p>
        <p className="truncate text-xs text-text-muted">
          {categoryLabel(expense.category)}
          {expense.due_day ? ` · due ${expense.due_day}${ordinalSuffix(expense.due_day)}` : ''}
          {ownerLabel ? ` · ${ownerLabel}` : ''}
        </p>
      </div>
      <div className="tnum shrink-0 text-right text-sm">
        {formatCurrency(expense.amount)}
        <span className="ml-0.5 font-normal text-text-muted">
          {FREQUENCY_SHORT[expense.frequency] ?? ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {readOnly ? null : isDeleted ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={isPending}
            aria-label="Restore"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-primary"
          >
            <RotateCcw size={15} strokeWidth={1.75} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <Pencil size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              aria-label="Remove"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-alert"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ordinalSuffix(n: number) {
  if (n >= 11 && n <= 13) return 'th'
  switch (n % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

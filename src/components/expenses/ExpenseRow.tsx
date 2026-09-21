import { Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { categoryIcon, categoryLabel } from '@/lib/categories'
import { formatCurrencyExact } from '@/lib/utils'
import type { Expense } from '@/lib/types'

interface ExpenseRowProps {
  expense: Expense
  onEdit?: () => void
  onDelete?: () => void
  onRestore?: () => void
  /** Removed rows only: delete for good (no undo). */
  onDeleteForever?: () => void
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

export function ExpenseRow({
  expense,
  onEdit,
  onDelete,
  onRestore,
  onDeleteForever,
  isPending,
  ownerLabel,
  readOnly,
}: ExpenseRowProps) {
  const Icon = categoryIcon(expense.category)
  const isDeleted = Boolean(expense.deleted_at)

  return (
    <div
      className={`group flex items-center gap-2 rounded-[10px] px-2 py-2.5 sm:gap-3 transition-colors ${
        isDeleted ? 'opacity-60' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-sm font-medium sm:truncate">{expense.name}</p>
        <p className="truncate text-xs text-text-muted">
          {categoryLabel(expense.category)}
          {expense.due_day ? ` · due ${expense.due_day}${ordinalSuffix(expense.due_day)}` : ''}
          {ownerLabel ? ` · ${ownerLabel}` : ''}
        </p>
      </div>
      <div className="tnum shrink-0 text-right text-sm">
        {expense.original_currency && expense.original_amount != null ? (
          <>
            {formatCurrencyExact(expense.original_amount, expense.original_currency)}
            <span className="ml-0.5 font-normal text-text-muted">
              {FREQUENCY_SHORT[expense.frequency] ?? ''}
            </span>
            <span className="block text-[11px] font-normal text-text-muted">
              ≈ {formatCurrencyExact(expense.amount)}
            </span>
          </>
        ) : (
          <>
            {formatCurrencyExact(expense.amount)}
            <span className="ml-0.5 font-normal text-text-muted">
              {FREQUENCY_SHORT[expense.frequency] ?? ''}
            </span>
          </>
        )}
      </div>
      {/* Always visible on touch screens (there is no hover); revealed on hover/focus on desktop. */}
      <div className="flex shrink-0 items-center opacity-100 sm:gap-1 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {readOnly ? null : isDeleted ? (
          <>
            <button
              type="button"
              onClick={onRestore}
              disabled={isPending}
              aria-label={`Restore ${expense.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-primary"
            >
              <RotateCcw size={15} strokeWidth={1.75} />
            </button>
            {onDeleteForever && (
              <button
                type="button"
                onClick={onDeleteForever}
                disabled={isPending}
                aria-label={`Delete ${expense.name} permanently`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-alert"
              >
                <XCircle size={15} strokeWidth={1.75} />
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${expense.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <Pencil size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              aria-label={`Remove ${expense.name}`}
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

import { Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { categoryColor, categoryIcon, categoryLabel } from '@/lib/categories'
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
      className={`group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors ${
        isDeleted ? 'opacity-60' : 'hover:bg-fill'
      }`}
    >
      <div
        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] text-white"
        style={{ background: isDeleted ? 'var(--chart-7)' : categoryColor(expense.category) }}
      >
        <Icon size={16} strokeWidth={2.1} />
      </div>
      <div
        className="min-w-0 flex-1"
        {...(onEdit && !readOnly && !isDeleted
          ? {
              role: 'button',
              tabIndex: -1,
              onClick: () => {
                // Touch screens: tapping the row opens the editor (the edit/remove icons are desktop-only).
                if (window.matchMedia('(hover: none)').matches) onEdit()
              },
            }
          : {})}
      >
        <p className="line-clamp-2 break-words text-[15px] font-semibold tracking-[-0.005em] sm:truncate">{expense.name}</p>
        <p className="truncate text-[12.5px] text-muted-foreground">
          {categoryLabel(expense.category)}
          {expense.due_day ? ` · due ${expense.due_day}${ordinalSuffix(expense.due_day)}` : ''}
          {ownerLabel ? ` · ${ownerLabel}` : ''}
        </p>
      </div>
      <div className="tnum shrink-0 text-right text-[15px] font-semibold">
        {expense.original_currency && expense.original_amount != null ? (
          <>
            {formatCurrencyExact(expense.original_amount, expense.original_currency)}
            <span className="ml-0.5 font-medium text-text-subtle">
              {FREQUENCY_SHORT[expense.frequency] ?? ''}
            </span>
            <span className="block text-[11.5px] font-medium text-text-subtle">
              ≈ {formatCurrencyExact(expense.amount)}
            </span>
          </>
        ) : (
          <>
            {formatCurrencyExact(expense.amount)}
            <span className="ml-0.5 font-medium text-text-subtle">
              {FREQUENCY_SHORT[expense.frequency] ?? ''}
            </span>
          </>
        )}
      </div>
      {/* Desktop: revealed on hover/focus. Touch: hidden — tap the row to edit (remove lives in the editor). Removed rows always show restore/delete. */}
      <div
        className={`shrink-0 items-center gap-0.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 ${
          isDeleted ? 'flex' : 'hidden [@media(hover:hover)]:flex'
        }`}
      >
        {readOnly ? null : isDeleted ? (
          <>
            <button
              type="button"
              onClick={onRestore}
              disabled={isPending}
              aria-label={`Restore ${expense.name}`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-fill hover:text-primary"
            >
              <RotateCcw size={15} strokeWidth={1.75} />
            </button>
            {onDeleteForever && (
              <button
                type="button"
                onClick={onDeleteForever}
                disabled={isPending}
                aria-label={`Delete ${expense.name} permanently`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-fill hover:text-alert"
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
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-fill hover:text-foreground"
            >
              <Pencil size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              aria-label={`Remove ${expense.name}`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-fill hover:text-alert"
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

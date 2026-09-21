import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/categories'
import { EXPENSE_FREQUENCIES, type Expense, type ExpenseFrequency, type NewExpense } from '@/lib/types'

interface ExpenseFormProps {
  initial?: Partial<Expense>
  compact?: boolean
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (values: NewExpense) => void
  onCancel?: () => void
}

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  annual: 'Annual',
  'once-off': 'Once-off',
}

export function ExpenseForm({
  initial,
  compact = false,
  isSubmitting = false,
  submitLabel = 'Add expense',
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [frequency, setFrequency] = useState<ExpenseFrequency>(
    (initial?.frequency as ExpenseFrequency) ?? 'monthly',
  )
  const [isFixed, setIsFixed] = useState(initial?.is_fixed ?? true)
  const [dueDay, setDueDay] = useState(initial?.due_day?.toString() ?? '')
  const [notifyEnabled, setNotifyEnabled] = useState(initial?.notify_enabled ?? false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !amount) return
    onSubmit({
      name: name.trim(),
      category,
      amount: Number(amount),
      frequency,
      is_fixed: isFixed,
      due_day: dueDay ? Number(dueDay) : undefined,
      notify_enabled: notifyEnabled,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div>
        <label className="field-label" htmlFor="expense-name">
          Name
        </label>
        <input
          id="expense-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rent"
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="expense-amount">
            Amount
          </label>
          <input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="expense-frequency">
            Frequency
          </label>
          <select
            id="expense-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ExpenseFrequency)}
          >
            {EXPENSE_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="expense-category">
          Category
        </label>
        <select
          id="expense-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {!compact && (
        <>
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-input p-1">
            <button
              type="button"
              onClick={() => setIsFixed(true)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                isFixed ? 'bg-surface-3 text-foreground' : 'text-text-muted'
              }`}
            >
              Fixed
            </button>
            <button
              type="button"
              onClick={() => setIsFixed(false)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                !isFixed ? 'bg-surface-3 text-foreground' : 'text-text-muted'
              }`}
            >
              Variable
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="expense-due-day">
                Due day (optional)
              </label>
              <input
                id="expense-due-day"
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="1–31"
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={notifyEnabled}
                onChange={(e) => setNotifyEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
                style={{ width: 'auto' }}
              />
              Notify me
            </label>
          </div>
        </>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

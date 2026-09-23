import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Select } from '@/components/ui/Select'
import { Segmented } from '@/components/ui/Segmented'
import { SwitchRow } from '@/components/ui/Switch'
import { useProfile } from '@/hooks/useProfile'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/categories'
import {
  CURRENCIES,
  EXPENSE_FREQUENCIES,
  type Expense,
  type ExpenseFrequency,
  type NewExpense,
} from '@/lib/types'
import { formatCurrencyExact } from '@/lib/utils'

interface ExpenseFormProps {
  initial?: Partial<Expense>
  compact?: boolean
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (values: NewExpense) => void
  onCancel?: () => void
  /** Edit mode: shows a "Remove expense" action (soft delete, undoable). */
  onDelete?: () => void
}

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  annual: 'Annual',
  'once-off': 'Once-off',
}

const LEAD_DAY_OPTIONS = [1, 2, 3, 5, 7, 14]

export function ExpenseForm({
  initial,
  compact = false,
  isSubmitting = false,
  submitLabel = 'Add expense',
  onSubmit,
  onCancel,
  onDelete,
}: ExpenseFormProps) {
  const { data: profile } = useProfile()
  const homeCurrency = profile?.currency_code ?? 'ZAR'
  const multiCurrency = Boolean(profile?.multi_currency_enabled)

  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0])
  // When an expense was entered in a foreign currency, edit it in that currency; the converted amount is derived.
  const initialForeign = Boolean(initial?.original_currency && initial?.original_amount != null)
  const [amount, setAmount] = useState(
    (initialForeign ? initial?.original_amount : initial?.amount)?.toString() ?? '',
  )
  const [currency, setCurrency] = useState<string>(initialForeign ? initial!.original_currency! : '')
  const [rate, setRate] = useState(initial?.exchange_rate?.toString() ?? '')
  const [frequency, setFrequency] = useState<ExpenseFrequency>(
    (initial?.frequency as ExpenseFrequency) ?? 'monthly',
  )
  const [isFixed, setIsFixed] = useState(initial?.is_fixed ?? true)
  const [dueDay, setDueDay] = useState(initial?.due_day?.toString() ?? '')
  const [notifyEnabled, setNotifyEnabled] = useState(initial?.notify_enabled ?? false)
  const [leadDays, setLeadDays] = useState(initial?.notify_lead_days ?? 3)
  const [workRelated, setWorkRelated] = useState(initial?.work_related ?? false)
  const [error, setError] = useState<string | null>(null)

  const currencyChoice = currency || homeCurrency
  const isForeign = (multiCurrency || initialForeign) && currencyChoice !== homeCurrency
  const numericAmount = Number(amount)
  const numericRate = Number(rate)
  const convertedAmount = isForeign ? numericAmount * numericRate : numericAmount

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Give the expense a name.')
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter an amount greater than zero.')
    if (isForeign && (!Number.isFinite(numericRate) || numericRate <= 0)) {
      return setError(`Enter the exchange rate (1 ${currencyChoice} in ${homeCurrency}).`)
    }
    const due = dueDay ? Math.floor(Number(dueDay)) : null
    if (due !== null && (due < 1 || due > 31)) return setError('The due day must be between 1 and 31.')
    if (notifyEnabled && due === null) return setError('Add a due day so Loot knows when to remind you.')

    onSubmit({
      name: name.trim(),
      category,
      amount: Math.round(convertedAmount * 100) / 100,
      frequency,
      is_fixed: isFixed,
      // null (not undefined) so clearing the field on an existing expense actually clears it.
      due_day: due,
      notify_enabled: notifyEnabled,
      notify_lead_days: leadDays,
      work_related: workRelated,
      original_amount: isForeign ? numericAmount : null,
      original_currency: isForeign ? currencyChoice : null,
      exchange_rate: isForeign ? numericRate : null,
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
          autoFocus={!compact}
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
            min={0.01}
            step="any"
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
          <Select
            id="expense-frequency"
            value={frequency}
            onValueChange={(v) => setFrequency(v as ExpenseFrequency)}
            options={EXPENSE_FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
          />
        </div>
      </div>

      {(multiCurrency || initialForeign) && !compact && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="expense-currency">
              Currency
            </label>
            <Select
              id="expense-currency"
              value={currencyChoice}
              onValueChange={setCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c === homeCurrency ? `${c} (home)` : c }))}
            />
          </div>
          {isForeign && (
            <div>
              <label className="field-label" htmlFor="expense-rate">
                Rate (1 {currencyChoice} = ? {homeCurrency})
              </label>
              <input
                id="expense-rate"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 18.5"
                required
              />
            </div>
          )}
        </div>
      )}
      {isForeign && Number.isFinite(convertedAmount) && convertedAmount > 0 && (
        <p className="-mt-1.5 text-xs text-text-muted">
          Counts as {formatCurrencyExact(convertedAmount, homeCurrency)} in your budget.
        </p>
      )}

      <div>
        <label className="field-label" htmlFor="expense-category">
          Category
        </label>
        <Select
          id="expense-category"
          value={category}
          onValueChange={setCategory}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
        />
      </div>

      {!compact && (
        <>
          <div>
            <span className="field-label">Type</span>
            <Segmented
              full
              label="Expense type"
              value={isFixed ? 'fixed' : 'variable'}
              onChange={(v) => setIsFixed(v === 'fixed')}
              options={[
                { value: 'fixed', label: 'Fixed — same every month' },
                { value: 'variable', label: 'Variable — changes' },
              ]}
            />
          </div>

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
              placeholder="Day of the month, 1–31"
            />
          </div>

          <div className="divide-y divide-hairline rounded-xl bg-surface-2 px-4 py-1">
            <SwitchRow
              label="Remind me before it's due"
              checked={notifyEnabled}
              onChange={setNotifyEnabled}
            />
            <SwitchRow
              label="Work-related"
              hint="May be tax-deductible — shows up in the Tax centre"
              checked={workRelated}
              onChange={setWorkRelated}
            />
          </div>

          {notifyEnabled && (
            <div>
              <label className="field-label" htmlFor="expense-lead-days">
                When to remind you
              </label>
              <Select
                id="expense-lead-days"
                value={leadDays.toString()}
                onValueChange={(v) => setLeadDays(Number(v))}
                options={LEAD_DAY_OPTIONS.map((d) => ({
                  value: d.toString(),
                  label: `${d} day${d === 1 ? '' : 's'} before it's due`,
                }))}
              />
            </div>
          )}

        </>
      )}

      {error && (
        <p role="alert" className="text-[13px] font-medium text-alert">
          {error}
        </p>
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
      {onDelete && (
        <button type="button" onClick={onDelete} className="w-full py-2 text-[15px] font-semibold text-alert">
          Remove expense
        </button>
      )}
    </form>
  )
}

import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABELS } from '@/lib/categories'
import type { NewGoal, SavingsGoal } from '@/lib/types'

interface GoalFormProps {
  initial?: Partial<SavingsGoal>
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (values: NewGoal) => void
  onCancel?: () => void
}

export function GoalForm({
  initial,
  isSubmitting = false,
  submitLabel = 'Create goal',
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? GOAL_CATEGORIES[0])
  const [targetAmount, setTargetAmount] = useState(initial?.target_amount?.toString() ?? '')
  const [currentAmount, setCurrentAmount] = useState(initial?.current_amount?.toString() ?? '0')
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [auto, setAuto] = useState(initial?.progress_mode === 'auto')
  const [weight, setWeight] = useState(String(initial?.weight ?? 1))
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const target = Number(targetAmount)
    const current = currentAmount === '' ? 0 : Number(currentAmount)
    const weightNum = weight === '' ? 1 : Number(weight)
    if (!name.trim()) return setError('Give the goal a name.')
    if (!Number.isFinite(target) || target <= 0) return setError('The target amount must be more than zero.')
    if (!Number.isFinite(current) || current < 0) return setError("'Already saved' can't be negative.")
    if (auto && (!Number.isFinite(weightNum) || weightNum <= 0)) return setError('The share weight must be more than zero.')
    onSubmit({
      name: name.trim(),
      category,
      target_amount: target,
      current_amount: current,
      // null (not undefined) so clearing these on an existing goal actually clears them.
      target_date: targetDate || null,
      note: note.trim() || null,
      progress_mode: auto ? 'auto' : 'manual',
      ...(auto ? { weight: weightNum } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div>
        <label className="field-label" htmlFor="goal-name">
          Name
        </label>
        <input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Emergency fund"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="field-label" htmlFor="goal-category">
          Category
        </label>
        <Select
          id="goal-category"
          value={category}
          onValueChange={setCategory}
          options={GOAL_CATEGORIES.map((c) => ({ value: c, label: GOAL_CATEGORY_LABELS[c] }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="goal-target">
            Target amount
          </label>
          <input
            id="goal-target"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="any"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="0"
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="goal-current">
            Already saved
          </label>
          <input
            id="goal-current"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={currentAmount}
            onChange={(e) => setCurrentAmount(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="goal-date">
          Target date (optional)
        </label>
        <input id="goal-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </div>

      <div>
        <label className="field-label" htmlFor="goal-note">
          Note (optional)
        </label>
        <input
          id="goal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Three months of expenses"
        />
      </div>

      <div className="space-y-3 rounded-xl bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium">Auto-fund from my spare loot</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Each month Loot adds a share of what&apos;s left after your safety buffer to this goal&apos;s progress. It only
              tracks the amount — it never moves real money, so still make the transfer with your bank. Off = you log
              contributions yourself.
            </p>
          </div>
          <Switch checked={auto} onChange={setAuto} label="Auto-fund from my spare loot" />
        </div>
        {auto && (
          <div className="border-t border-hairline pt-3">
            <label className="field-label" htmlFor="goal-weight">
              Share weight
            </label>
            <input
              id="goal-weight"
              type="number"
              inputMode="decimal"
              min={0.1}
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="max-w-28"
            />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              A goal with weight 2 gets twice the share of one with weight 1. (Ignored if you split in priority order —
              see Settings.)
            </p>
          </div>
        )}
      </div>

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
    </form>
  )
}

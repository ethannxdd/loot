import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !targetAmount) return
    onSubmit({
      name: name.trim(),
      category,
      target_amount: Number(targetAmount),
      current_amount: currentAmount ? Number(currentAmount) : 0,
      target_date: targetDate || undefined,
      note: note.trim() || undefined,
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
        <select id="goal-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {GOAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {GOAL_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
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
            min={0}
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
        <input
          id="goal-date"
          type="date"
          value={targetDate ?? ''}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="goal-note">
          Note (optional)
        </label>
        <input
          id="goal-note"
          value={note ?? ''}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Three months of expenses"
        />
      </div>

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

import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { emptyPhase } from '@/lib/planner-math'
import { estimateEffectiveTaxRatePct } from '@/lib/tax/tax-math'
import type { NewPlannerPlan, PlannerPhase, PlannerPlan } from '@/lib/types'
import { PhaseEditor } from './PhaseEditor'

interface PlanEditorProps {
  initial?: PlannerPlan
  isSubmitting?: boolean
  onSubmit: (values: NewPlannerPlan) => void
  onCancel: () => void
}

export function PlanEditor({ initial, isSubmitting, onSubmit, onCancel }: PlanEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [taxRatePct, setTaxRatePct] = useState(initial?.tax_rate_pct?.toString() ?? '25')
  const [phases, setPhases] = useState<PlannerPhase[]>(
    initial?.phases && initial.phases.length > 0 ? initial.phases : [emptyPhase('Phase 1')]
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  function updatePhase(index: number, phase: PlannerPhase) {
    setPhases((prev) => prev.map((p, i) => (i === index ? phase : p)))
  }

  function addPhase() {
    setPhases((prev) => [...prev, emptyPhase(`Phase ${prev.length + 1}`)])
  }

  function removePhase(index: number) {
    setPhases((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    setError(null)
    const rate = taxRatePct === '' ? 0 : Number(taxRatePct)
    if (!name.trim()) return setError('Give the plan a name.')
    if (!Number.isFinite(rate) || rate < 0 || rate > 60) return setError('The tax rate must be between 0% and 60%.')
    if (phases.length === 0) return setError('A plan needs at least one phase.')
    if (phases.some((p) => !p.name.trim())) return setError('Every phase needs a name.')
    onSubmit({
      name: name.trim(),
      tax_rate_pct: rate,
      // Half-filled expense rows (no name and no amount) are dropped rather than saved as blanks.
      phases: phases.map((p) => ({
        ...p,
        name: p.name.trim(),
        expenses: p.expenses.filter((e) => e.name.trim() || e.amount).map((e) => ({ ...e, name: e.name.trim() || 'Expense' })),
      })),
      // null (not undefined) so clearing the notes on an existing plan actually clears them.
      notes: notes.trim() || null,
    })
  }

  const firstIncome = phases.find((p) => p.gross_income > 0)?.gross_income ?? 0

  return (
    <div className="space-y-4">
      <div>
        <label className="field-label" htmlFor="plan-name">
          Plan name
        </label>
        <input
          id="plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. New job offer"
          autoFocus
        />
      </div>

      <div>
        <label className="field-label" htmlFor="plan-tax-rate">
          Effective tax rate (%)
        </label>
        <input
          id="plan-tax-rate"
          type="number"
          min={0}
          max={60}
          step={0.1}
          value={taxRatePct}
          onChange={(e) => setTaxRatePct(e.target.value)}
        />
        <button
          type="button"
          disabled={firstIncome <= 0}
          onClick={() => setTaxRatePct(String(estimateEffectiveTaxRatePct(firstIncome)))}
          className="mt-1.5 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Estimate from SARS tables using the first phase’s income
        </button>
      </div>

      <div className="space-y-3">
        {phases.map((phase, i) => (
          <PhaseEditor
            key={i}
            phase={phase}
            taxRatePct={Number(taxRatePct) || 0}
            onChange={(p) => updatePhase(i, p)}
            onRemove={phases.length > 1 ? () => removePhase(i) : undefined}
          />
        ))}
        <button
          type="button"
          onClick={addPhase}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          <Plus size={14} strokeWidth={2} /> Add phase
        </button>
      </div>

      <div>
        <label className="field-label" htmlFor="plan-notes">
          Notes (optional)
        </label>
        <textarea
          id="plan-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything worth remembering about this plan"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="btn btn-primary flex-1">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {initial ? 'Save plan' : 'Create plan'}
        </button>
      </div>
    </div>
  )
}

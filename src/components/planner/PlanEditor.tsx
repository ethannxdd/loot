import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { emptyPhase } from '@/lib/planner-math'
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
    if (!name.trim() || phases.length === 0) return
    onSubmit({ name: name.trim(), tax_rate_pct: Number(taxRatePct) || 0, phases, notes: notes.trim() || undefined })
  }

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
          max={100}
          step={0.1}
          value={taxRatePct}
          onChange={(e) => setTaxRatePct(e.target.value)}
        />
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

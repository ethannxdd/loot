import { Plus, Trash2 } from 'lucide-react'
import { computePhase } from '@/lib/planner-math'
import { formatCurrency } from '@/lib/utils'
import type { PlannerPhase } from '@/lib/types'

interface PhaseEditorProps {
  phase: PlannerPhase
  taxRatePct: number
  onChange: (phase: PlannerPhase) => void
  onRemove?: () => void
}

export function PhaseEditor({ phase, taxRatePct, onChange, onRemove }: PhaseEditorProps) {
  const computed = computePhase(phase, taxRatePct)

  function updateExpense(index: number, patch: Partial<{ name: string; amount: number }>) {
    const expenses = phase.expenses.map((e, i) => (i === index ? { ...e, ...patch } : e))
    onChange({ ...phase, expenses })
  }

  function addExpense() {
    onChange({ ...phase, expenses: [...phase.expenses, { name: '', amount: 0 }] })
  }

  function removeExpense(index: number) {
    onChange({ ...phase, expenses: phase.expenses.filter((_, i) => i !== index) })
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={phase.name}
          onChange={(e) => onChange({ ...phase, name: e.target.value })}
          placeholder="Phase name"
          className="flex-1 !bg-transparent !border-0 !p-0 text-sm font-bold"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove phase"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="mb-3">
        <label className="field-label">Gross income (monthly)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={phase.gross_income || ''}
          onChange={(e) => onChange({ ...phase, gross_income: Number(e.target.value) || 0 })}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <label className="field-label">Expenses</label>
        {phase.expenses.map((exp, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={exp.name}
              onChange={(e) => updateExpense(i, { name: e.target.value })}
              placeholder="Expense name"
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={exp.amount || ''}
              onChange={(e) => updateExpense(i, { amount: Number(e.target.value) || 0 })}
              placeholder="0"
              className="w-28"
            />
            <button
              type="button"
              onClick={() => removeExpense(i)}
              aria-label="Remove expense"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addExpense}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary"
        >
          <Plus size={14} strokeWidth={2} /> Add expense
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-center">
        <div>
          <p className="overline">Net income</p>
          <p className="tnum text-sm">{formatCurrency(computed.netIncome)}</p>
        </div>
        <div>
          <p className="overline">Expenses</p>
          <p className="tnum text-sm">{formatCurrency(computed.totalExpenses)}</p>
        </div>
        <div>
          <p className="overline">Leftover</p>
          <p className={`tnum text-sm ${computed.leftover < 0 ? 'text-alert' : 'text-primary'}`}>
            {formatCurrency(computed.leftover)}
          </p>
        </div>
      </div>
    </div>
  )
}

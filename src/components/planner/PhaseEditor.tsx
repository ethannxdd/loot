import { Plus, Trash2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/categories'
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

  function updateExpense(index: number, patch: Partial<{ name: string; amount: number; category: string }>) {
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
    <div className="rounded-2xl bg-surface-2 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={phase.name}
          onChange={(e) => onChange({ ...phase, name: e.target.value })}
          placeholder="Phase name"
          aria-label="Phase name"
          className="flex-1 !border-0 !bg-transparent !p-0 !text-[17px] font-semibold !shadow-none"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove phase"
            className="grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="mb-3">
        <span className="field-label">Gross income (monthly)</span>
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
        <span className="field-label">Expenses</span>
        {phase.expenses.map((exp, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl sm:grid-cols-[1fr_170px_112px_auto] sm:items-center">
            <input
              value={exp.name}
              onChange={(e) => updateExpense(i, { name: e.target.value })}
              placeholder="Expense name"
              aria-label="Expense name"
              className="col-span-1"
            />
            <button
              type="button"
              onClick={() => removeExpense(i)}
              aria-label="Remove expense"
              className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full text-text-subtle hover:bg-fill hover:text-alert sm:order-last"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
            <div className="col-span-2 grid grid-cols-[1fr_112px] gap-2 sm:col-span-2 sm:contents">
              <Select
                aria-label="Category"
                value={exp.category ?? ''}
                placeholder="Category"
                onValueChange={(v) => updateExpense(i, { category: v })}
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={exp.amount || ''}
                onChange={(e) => updateExpense(i, { amount: Number(e.target.value) || 0 })}
                placeholder="0"
                aria-label="Monthly amount"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addExpense}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"
        >
          <Plus size={14} strokeWidth={2} /> Add expense
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center">
        <div>
          <p className="text-[12px] text-muted-foreground">Net income</p>
          <p className="tnum text-[15px] font-semibold">{formatCurrency(computed.netIncome)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted-foreground">Expenses</p>
          <p className="tnum text-[15px] font-semibold">{formatCurrency(computed.totalExpenses)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted-foreground">Left over</p>
          <p className={`tnum text-[15px] font-semibold ${computed.leftover < 0 ? 'text-alert' : 'text-primary'}`}>
            {formatCurrency(computed.leftover)}
          </p>
        </div>
      </div>
    </div>
  )
}

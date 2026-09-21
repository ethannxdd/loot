import { Link } from '@tanstack/react-router'
import { Loader2, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CheckHistoryList } from '@/components/checker/CheckHistoryList'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { Modal } from '@/components/ui/Modal'
import { useAffordabilityChecks, useCreateAffordabilityCheck } from '@/hooks/useAffordabilityChecks'
import { useAddExpense, useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import { toast } from 'sonner'
import { useProfile } from '@/hooks/useProfile'
import {
  checkAffordability,
  disposableIncome,
  safetyBufferAmount,
  type AffordabilityResult,
} from '@/lib/money'
import { VERDICT_META } from '@/lib/verdict'
import type { NewExpense } from '@/lib/types'

export function CheckerPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [] } = useGoals()
  const { data: history = [] } = useAffordabilityChecks()
  const createCheck = useCreateAffordabilityCheck()
  const addExpense = useAddExpense()

  const [itemName, setItemName] = useState('')
  const [amount, setAmount] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  // The result is pinned to the inputs it was run with, so editing the form afterwards can't silently
  // change what "Add to expenses" pre-fills or whether it shows.
  const [checked, setChecked] = useState<{
    itemName: string
    amount: number
    isRecurring: boolean
    result: AffordabilityResult
  } | null>(null)
  const [addToExpensesOpen, setAddToExpensesOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const result = checked?.result ?? null

  function runCheck(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!profile || !itemName.trim() || !amount) return
    if (!(Number(amount) > 0)) {
      setFormError('Enter an amount greater than zero.')
      return
    }

    const disposable = disposableIncome(profile.net_income, expenses)
    const safetyBuffer = safetyBufferAmount(profile.net_income, profile.safety_buffer_pct)
    const savingsBalance = goals
      .filter((g) => !g.is_completed)
      .reduce((sum, g) => sum + g.current_amount, 0)
    const emergencyFund = goals.find((g) => g.category === 'emergency_fund')?.target_amount

    const verdictResult = checkAffordability({
      itemName: itemName.trim(),
      amount: Number(amount),
      isRecurring,
      disposableIncome: disposable,
      safetyBuffer,
      savingsBalance,
      emergencyFundTarget: emergencyFund,
    })

    setChecked({
      itemName: itemName.trim(),
      amount: Number(amount),
      isRecurring,
      result: verdictResult,
    })
    createCheck.mutate({
      item_name: itemName.trim(),
      amount: Number(amount),
      is_recurring: isRecurring,
      verdict: verdictResult.verdict,
      reasoning: verdictResult.reasoning,
      disposable_at_check: disposable,
      currency_code: profile.currency_code,
    })
  }

  function handleAddToExpenses(values: NewExpense) {
    addExpense.mutate(values, {
      onSuccess: () => {
        setAddToExpensesOpen(false)
        toast.success(`${values.name} added to your expenses`)
      },
    })
  }

  const VerdictIcon = result ? VERDICT_META[result.verdict].icon : null

  return (
    <div className="animate-enter mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Affordability Checker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask "can I afford this?" and get a straight answer, grounded in your real numbers.
        </p>
      </header>

      {profile && profile.net_income <= 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border border-caution/30 text-sm">
          <p className="text-muted-foreground">
            You haven't set your income yet, so every check will come back negative.
          </p>
          <Link to="/settings" className="btn btn-ghost !h-8 !px-3 !text-xs">
            Set income
          </Link>
        </div>
      )}

      <form onSubmit={runCheck} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="check-item">
              What is it?
            </label>
            <input
              id="check-item"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="New couch"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="check-amount">
              Amount
            </label>
            <input
              id="check-amount"
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
        </div>

        <div className="flex rounded-[10px] border border-border bg-input p-1">
          <button
            type="button"
            onClick={() => setIsRecurring(false)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              !isRecurring ? 'bg-surface-3 text-foreground' : 'text-text-muted'
            }`}
          >
            Once-off
          </button>
          <button
            type="button"
            onClick={() => setIsRecurring(true)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              isRecurring ? 'bg-surface-3 text-foreground' : 'text-text-muted'
            }`}
          >
            Recurring monthly
          </button>
        </div>

        {formError && (
          <p role="alert" className="text-xs text-alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={createCheck.isPending || !profile}
          className="btn btn-secondary w-full"
        >
          {createCheck.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} strokeWidth={2} />
          )}
          Run the check
        </button>
      </form>

      {result && VerdictIcon && (
        <div className="card-elevated animate-enter space-y-3">
          <div className="flex items-center gap-3">
            <VerdictIcon
              size={28}
              strokeWidth={1.75}
              className={VERDICT_META[result.verdict].colorClass}
            />
            <span className={`text-lg font-bold ${VERDICT_META[result.verdict].colorClass}`}>
              {VERDICT_META[result.verdict].label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{result.reasoning}</p>
          {checked?.isRecurring && result.verdict !== 'not-recommended' && (
            <button
              type="button"
              onClick={() => setAddToExpensesOpen(true)}
              className="btn btn-ghost"
            >
              Add to expenses
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <div className="overline px-1">History</div>
          <CheckHistoryList checks={history} />
        </section>
      )}

      {addToExpensesOpen && (
        <Modal title="Add to expenses" onClose={() => setAddToExpensesOpen(false)}>
          <ExpenseForm
            initial={{ name: checked?.itemName ?? itemName, amount: checked?.amount ?? Number(amount), frequency: 'monthly' }}
            onSubmit={handleAddToExpenses}
            onCancel={() => setAddToExpensesOpen(false)}
            isSubmitting={addExpense.isPending}
            submitLabel="Add to expenses"
          />
        </Modal>
      )}
    </div>
  )
}

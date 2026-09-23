import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CheckHistoryList } from '@/components/checker/CheckHistoryList'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAffordabilityChecks } from '@/hooks/useAffordabilityChecks'
import { useAddExpense, useExpenses } from '@/hooks/useExpenses'
import { useGoals } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { useRunAffordabilityCheck } from '@/hooks/useRunAffordabilityCheck'
import { disposableIncome, safetyBufferAmount, type AffordabilityResult } from '@/lib/money'
import type { NewExpense } from '@/lib/types'
import { formatCurrency, formatCurrencyExact } from '@/lib/utils'
import { VERDICT_META } from '@/lib/verdict'

const VERDICT_TONE = {
  comfortable: { ring: 'bg-primary/12 text-primary', chip: 'chip-positive' },
  tight: { ring: 'bg-caution/14 text-caution', chip: 'chip-caution' },
  'not-recommended': { ring: 'bg-alert/12 text-alert', chip: 'chip-alert' },
} as const

export function CheckerPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [] } = useGoals()
  const { data: history = [] } = useAffordabilityChecks()
  const { run, ready, isSaving } = useRunAffordabilityCheck()
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
  const addFormRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (addToExpensesOpen) addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [addToExpensesOpen])

  const disposable = profile ? disposableIncome(profile.net_income, expenses) : 0
  const buffer = profile ? safetyBufferAmount(profile.net_income, profile.safety_buffer_pct) : 0
  const savings = goals.filter((g) => !g.is_completed).reduce((s, g) => s + g.current_amount, 0)

  function runCheck(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!profile || !itemName.trim() || !amount) return
    if (!(Number(amount) > 0)) {
      setFormError('Enter an amount greater than zero.')
      return
    }
    const verdictResult = run({ itemName: itemName.trim(), amount: Number(amount), isRecurring })
    if (!verdictResult) return
    setAddToExpensesOpen(false)
    setChecked({ itemName: itemName.trim(), amount: Number(amount), isRecurring, result: verdictResult })
    // On phones the verdict renders below the form — bring it into view.
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
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
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Can I afford it?"
        subtitle="Ask before you buy, and get a straight answer from your real numbers."
      />

      {profile && profile.net_income <= 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !py-4">
          <p className="text-[14px] text-muted-foreground">
            You haven&apos;t set your income yet, so every check will come back negative.
          </p>
          <Link to="/settings" className="btn btn-ghost !min-h-9 !text-[13px]">
            Set income
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <form onSubmit={runCheck} data-tutorial="checker-form" className="object-card flex flex-col p-6 sm:p-7 lg:col-span-7" aria-label="Affordability check">
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em]">What are you thinking of buying?</h2>
          <p className="mt-1.5 mb-5 text-[14px] text-white/60">We&apos;ll weigh it against what you have left and your safety buffer.</p>
          <label className="mb-1.5 text-[13px] font-semibold text-white/60" htmlFor="check-item">
            What is it?
          </label>
          <input
            id="check-item"
            className="object-field mb-3"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="New couch"
            autoComplete="off"
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-white/60" htmlFor="check-amount">
                Amount
              </label>
              <input
                id="check-amount"
                className="object-field tnum"
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
              <span className="mb-1.5 block text-[13px] font-semibold text-white/60">How is it paid?</span>
              <div className="flex h-11 rounded-xl bg-white/9 p-[3px]" role="radiogroup" aria-label="Cost type">
                {[
                  { v: false, l: 'Once-off' },
                  { v: true, l: 'Every month' },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    role="radio"
                    aria-checked={isRecurring === o.v}
                    onClick={() => setIsRecurring(o.v)}
                    className={`flex-1 rounded-[9px] text-[13.5px] font-semibold transition-colors ${
                      isRecurring === o.v ? 'bg-white/92 text-black' : 'text-white/60'
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {formError && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-[#ff8a80]">
              {formError}
            </p>
          )}
          <button type="submit" disabled={isSaving || !ready} className="btn mt-5 w-full !min-h-12 !rounded-xl bg-white !text-[15px] text-black">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            Run the check <ArrowRight size={16} strokeWidth={2.2} />
          </button>
        </form>

        <div className="flex flex-col gap-4 lg:col-span-5">
          {result && VerdictIcon && checked ? (
            <section ref={resultRef} className="card-elevated animate-enter flex flex-1 flex-col scroll-mt-6 sm:p-6" aria-live="polite">
              <div className="flex items-center gap-3.5">
                <span className={`grid h-12 w-12 place-items-center rounded-full ${VERDICT_TONE[result.verdict].ring}`}>
                  <VerdictIcon size={24} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-muted-foreground">
                    {checked.itemName} · {formatCurrencyExact(checked.amount)}
                    {checked.isRecurring ? ' a month' : ''}
                  </p>
                  <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em]">
                    {VERDICT_META[result.verdict].label}
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed">{result.reasoning}</p>
              {checked.isRecurring && result.verdict !== 'not-recommended' && !addToExpensesOpen && (
                <button type="button" onClick={() => setAddToExpensesOpen(true)} className="btn btn-primary mt-5 self-start">
                  <Plus size={16} strokeWidth={2.4} /> Add to expenses
                </button>
              )}
            </section>
          ) : (
            <section className="card flex-1 sm:p-6">
              <h2 className="card-title">What the check looks at</h2>
              <dl className="mt-3 divide-y divide-hairline">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[14px] text-muted-foreground">Left this month</dt>
                  <dd className={`tnum text-[15px] font-semibold ${disposable < 0 ? 'text-alert' : ''}`}>{formatCurrency(disposable)}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[14px] text-muted-foreground">
                    Safety buffer <span className="text-text-subtle">({profile?.safety_buffer_pct ?? 0}% of pay)</span>
                  </dt>
                  <dd className="tnum text-[15px] font-semibold">{formatCurrency(buffer)}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[14px] text-muted-foreground">Saved in your goals</dt>
                  <dd className="tnum text-[15px] font-semibold">{formatCurrency(savings)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Monthly costs must leave your buffer intact. Once-off buys are weighed against your savings and emergency
                fund target.
              </p>
            </section>
          )}
        </div>
      </div>

      {addToExpensesOpen && (
        <div ref={addFormRef} className="card-elevated animate-enter scroll-mt-6 space-y-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">Add to expenses</h2>
            <button
              type="button"
              onClick={() => setAddToExpensesOpen(false)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="max-w-2xl">
            <ExpenseForm
              initial={{ name: checked?.itemName ?? itemName, amount: checked?.amount ?? Number(amount), frequency: 'monthly' }}
              onSubmit={handleAddToExpenses}
              onCancel={() => setAddToExpensesOpen(false)}
              isSubmitting={addExpense.isPending}
              submitLabel="Add to expenses"
            />
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="card-title px-1">Past checks</h2>
          <CheckHistoryList checks={history} />
        </section>
      )}
    </div>
  )
}

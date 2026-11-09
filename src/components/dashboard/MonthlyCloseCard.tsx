import { ChevronLeft, ChevronRight, Download, Lock, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCurrentMonthSnapshot, useLockCurrentMonth } from '@/hooks/useMonthlyClose'
import { useProfile } from '@/hooks/useProfile'
import { useExpenses, useUpdateExpense } from '@/hooks/useExpenses'
import { useSafeToSpend } from '@/hooks/useSpendEntries'
import { categoryLabel } from '@/lib/categories'
import { cycleForMonth } from '@/lib/cycle'
import { repeatedOverspend } from '@/lib/spending'
import { MonthlyCloseExportDoc } from '@/components/export/ExportDocs'
import { exportDocument } from '@/lib/export'
import { monthLabel, monthlyEquivalent } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'

const BASE_STEPS = ['Income', 'Fixed expenses', 'Variable expenses', 'Notes', 'Lock'] as const
/** Phase 6: with payday cycles on, a "Review spending" step sits between variable expenses and notes. */
const LIVE_STEPS = ['Income', 'Fixed expenses', 'Variable expenses', 'Review spending', 'Notes', 'Lock'] as const
type StepName = (typeof LIVE_STEPS)[number]

export function MonthlyCloseCard() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: currentSnapshot, isLoading } = useCurrentMonthSnapshot()
  const lockMonth = useLockCurrentMonth()
  const live = useSafeToSpend()
  const updateExpense = useUpdateExpense()
  const STEPS: readonly StepName[] = live.live ? LIVE_STEPS : BASE_STEPS
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [notes, setNotes] = useState('')
  const wizardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (wizardOpen) wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [wizardOpen])

  if (isLoading || !profile) return <div className="skeleton h-40 rounded-2xl" />

  const isLocked = Boolean(currentSnapshot?.locked_at)
  const current = STEPS[Math.min(step, STEPS.length - 1)]
  const active = expenses.filter((e) => !e.deleted_at)
  const fixed = active.filter((e) => e.is_fixed)
  const variable = active.filter((e) => !e.is_fixed)

  function openWizard() {
    setStep(0)
    setNotes('')
    setWizardOpen(true)
  }

  async function handleExport() {
    if (!currentSnapshot) return
    await exportDocument(<MonthlyCloseExportDoc snapshot={currentSnapshot} />, `loot-monthly-close-${currentSnapshot.month}`, 'pdf')
  }

  const cycleMode = live.live && !live.cycle.calendar
  const monthName = cycleMode ? live.cycle.shortLabel : new Date().toLocaleDateString('en-ZA', { month: 'long' })
  const now = new Date()
  const daysLeft = cycleMode ? live.cycle.daysLeft : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1

  // "Raise Groceries budget to R x" when a budget was over in this cycle and the one before (§3.2).
  const [cy, cm] = live.cycle.key.split('-').map(Number)
  const suggestions = live.live
    ? repeatedOverspend(live.entries, live.budgets, [live.cycle, cycleForMonth(cy, cm - 2, live.settings)])
    : []

  function raiseBudget(category: string, to: number, from: number) {
    // The budget is the sum of the category's variable expenses; put the increase on the biggest one.
    const target = variable.filter((e) => e.category === category && e.frequency === 'monthly').sort((a, b) => b.amount - a.amount)[0]
    if (!target) return
    updateExpense.mutate({ id: target.id, patch: { amount: Math.round((target.amount + (to - from)) * 100) / 100 } })
  }

  return (
    <div className="card space-y-4">
      {!wizardOpen && !isLocked && (
        <button type="button" onClick={openWizard} className="flex w-full items-center gap-3.5 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fill">
            <Lock size={17} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Close {monthName}</span>
            <span className="block text-[13px] text-muted-foreground">
              {daysLeft <= 1 ? 'Last day — ready to close' : `${daysLeft} days left in ${monthName}`} · {STEPS.length}{' '}
              quick steps
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-subtle" />
        </button>
      )}

      {isLocked && currentSnapshot ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              <Lock size={17} strokeWidth={2} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{monthLabel(currentSnapshot.month)} is closed</span>
              <span className="block text-[13px] text-muted-foreground">Numbers are locked in your history</span>
            </span>
          </div>
          {currentSnapshot.close_notes && (
            <p className="text-xs text-muted-foreground">{currentSnapshot.close_notes}</p>
          )}
          <button type="button" onClick={handleExport} className="btn btn-ghost w-full">
            <Download size={14} strokeWidth={1.75} />
            Export PDF summary
          </button>
        </div>
      ) : wizardOpen ? (
        <div ref={wizardRef} className="animate-enter space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">
              {current}
              <span className="ml-2 text-[13px] font-medium text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setWizardOpen(false)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-fill hover:text-foreground"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex gap-1" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-fill-2'}`} />
            ))}
          </div>

          {current === 'Income' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Does this month's income look right?</p>
              <div className="space-y-2 rounded-xl bg-surface-2 p-4">
                <div className="flex justify-between text-sm">
                  <span>Gross income</span>
                  <span className="tnum font-semibold">{formatCurrency(profile.gross_income)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Net income</span>
                  <span className="tnum font-semibold">{formatCurrency(profile.net_income)}</span>
                </div>
              </div>
              <p className="text-xs text-text-muted">Update this in Settings first if it's changed.</p>
            </div>
          )}

          {current === 'Fixed expenses' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Confirm your fixed expenses for the month.</p>
              {fixed.length === 0 && <p className="text-xs text-text-muted">No fixed expenses tracked.</p>}
              {fixed.map((e) => (
                <div key={e.id} className="flex justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                  <span>{e.name}</span>
                  <span className="tnum">{formatCurrency(monthlyEquivalent(e))}</span>
                </div>
              ))}
            </div>
          )}

          {current === 'Variable expenses' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Review your variable expenses.</p>
              {variable.length === 0 && <p className="text-xs text-text-muted">No variable expenses tracked.</p>}
              {variable.map((e) => (
                <div key={e.id} className="flex justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                  <span>{e.name}</span>
                  <span className="tnum">{formatCurrency(monthlyEquivalent(e))}</span>
                </div>
              ))}
            </div>
          )}

          {current === 'Review spending' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">What you logged this cycle against each budget.</p>
              {live.budgets.length === 0 && Object.keys(live.spentByCategory).length === 0 && (
                <p className="text-xs text-text-muted">Nothing logged this cycle.</p>
              )}
              {live.budgets.map((b) => {
                const spent = live.spentByCategory[b.category] ?? 0
                return (
                  <div key={b.category} className="flex justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                    <span>{categoryLabel(b.category)}</span>
                    <span className={`tnum ${spent > b.budget ? 'font-semibold text-alert' : ''}`}>
                      {formatCurrency(spent)} of {formatCurrency(b.budget)}
                    </span>
                  </div>
                )
              })}
              {live.unplanned > 0 && (
                <div className="flex justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                  <span>Unplanned</span>
                  <span className="tnum font-semibold text-caution">{formatCurrency(live.unplanned)}</span>
                </div>
              )}
              {suggestions.map((s) => (
                <div key={s.category} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--accent-tint)] px-3.5 py-2.5 text-sm">
                  <span>{categoryLabel(s.category)} was over two cycles running.</span>
                  <button
                    type="button"
                    disabled={updateExpense.isPending}
                    onClick={() => raiseBudget(s.category, s.suggested, s.budget)}
                    className="btn btn-secondary !min-h-8 !px-3 !text-[13px]"
                  >
                    Raise to {formatCurrency(s.suggested)}
                  </button>
                </div>
              ))}
            </div>
          )}

          {current === 'Notes' && (
            <div className="space-y-2">
              <label className="field-label" htmlFor="close-notes">
                Anything worth remembering about this month?
              </label>
              <textarea
                id="close-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes — one-off costs, changes to income, etc."
              />
            </div>
          )}

          {current === 'Lock' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Locking freezes this month's numbers in your history — they won't change even if you edit expenses
                later.
              </p>
              <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span>Disposable income</span>
                  <span className="tnum font-semibold">
                    {formatCurrency(profile.net_income - fixed.reduce((s, e) => s + monthlyEquivalent(e), 0) - variable.reduce((s, e) => s + monthlyEquivalent(e), 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn btn-ghost flex-1">
                <ChevronLeft size={15} /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="btn btn-primary flex-1">
                Next <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                disabled={lockMonth.isPending}
                onClick={() => lockMonth.mutate({ profile, expenses, notes }, { onSuccess: () => setWizardOpen(false) })}
                className="btn btn-primary flex-1"
              >
                <Lock size={14} strokeWidth={2} /> Lock month
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-1" aria-hidden="true">
          {STEPS.map((s) => (
            <span key={s} className="h-1 flex-1 rounded-full bg-fill-2" />
          ))}
        </div>
      )}

    </div>
  )
}

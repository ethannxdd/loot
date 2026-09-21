import { CalendarCheck, ChevronLeft, ChevronRight, Download, Lock } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useCurrentMonthSnapshot, useLockCurrentMonth } from '@/hooks/useMonthlyClose'
import { useProfile } from '@/hooks/useProfile'
import { useExpenses } from '@/hooks/useExpenses'
import { categoryLabel } from '@/lib/categories'
import { exportElementAsPdf } from '@/lib/export'
import { monthLabel, monthlyEquivalent } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'

const STEPS = ['Income', 'Fixed expenses', 'Variable expenses', 'Notes', 'Lock'] as const

export function MonthlyCloseCard() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: currentSnapshot, isLoading } = useCurrentMonthSnapshot()
  const lockMonth = useLockCurrentMonth()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [notes, setNotes] = useState('')
  const summaryRef = useRef<HTMLDivElement>(null)

  if (isLoading || !profile) return <div className="skeleton h-40 rounded-2xl" />

  const isLocked = Boolean(currentSnapshot?.locked_at)
  const active = expenses.filter((e) => !e.deleted_at)
  const fixed = active.filter((e) => e.is_fixed)
  const variable = active.filter((e) => !e.is_fixed)

  function openWizard() {
    setStep(0)
    setNotes('')
    setWizardOpen(true)
  }

  async function handleExport() {
    if (!summaryRef.current) return
    await exportElementAsPdf(summaryRef.current, `loot-monthly-close-${currentSnapshot?.month ?? 'summary'}`)
  }

  return (
    <div className="card space-y-4">
      <div className="overline flex items-center gap-1.5">
        <CalendarCheck size={13} strokeWidth={2} /> Monthly close
      </div>

      {isLocked && currentSnapshot ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Lock size={14} strokeWidth={2} />
            {monthLabel(currentSnapshot.month)} is locked
          </div>
          {currentSnapshot.close_notes && (
            <p className="text-xs text-muted-foreground">{currentSnapshot.close_notes}</p>
          )}
          <button type="button" onClick={handleExport} className="btn btn-ghost w-full">
            <Download size={14} strokeWidth={1.75} />
            Export PDF summary
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Confirm this month's numbers and lock them in — a 5-step guided close.
          </p>
          <button type="button" onClick={openWizard} className="btn btn-primary w-full">
            Start monthly close
          </button>
        </>
      )}

      {/* Hidden export target, kept in the DOM so html2canvas can render it even when the card is collapsed. */}
      {currentSnapshot && (
        <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden="true">
          <div ref={summaryRef} className="w-[420px] space-y-4 bg-background p-6 text-foreground">
            <h2 className="text-lg font-bold">Loot — Monthly Summary</h2>
            <p className="text-sm text-muted-foreground">{monthLabel(currentSnapshot.month)}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Net income</dt>
                <dd className="tnum font-semibold">{formatCurrency(currentSnapshot.net_income)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Total expenses</dt>
                <dd className="tnum font-semibold">{formatCurrency(currentSnapshot.total_expenses)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Disposable income</dt>
                <dd className="tnum font-semibold">{formatCurrency(currentSnapshot.disposable_income)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Savings rate</dt>
                <dd className="tnum font-semibold">{Math.round(currentSnapshot.savings_rate)}%</dd>
              </div>
            </dl>
            {Object.keys(currentSnapshot.expenses_by_category).length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">By category</p>
                <dl className="space-y-1 text-xs">
                  {Object.entries(currentSnapshot.expenses_by_category)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between">
                        <dt>{categoryLabel(cat)}</dt>
                        <dd className="tnum">{formatCurrency(amount)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}
            {currentSnapshot.close_notes && (
              <p className="border-t border-hairline pt-3 text-xs italic text-muted-foreground">{currentSnapshot.close_notes}</p>
            )}
          </div>
        </div>
      )}

      {wizardOpen && (
        <Modal title={`Monthly close · ${STEPS[step]}`} onClose={() => setWizardOpen(false)}>
          <div className="space-y-5">
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Does this month's income look right?</p>
                <div className="card-purple space-y-2 p-4">
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

            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Confirm your fixed expenses for the month.</p>
                {fixed.length === 0 && <p className="text-xs text-text-muted">No fixed expenses tracked.</p>}
                {fixed.map((e) => (
                  <div key={e.id} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span>{e.name}</span>
                    <span className="tnum">{formatCurrency(monthlyEquivalent(e))}</span>
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Review your variable expenses.</p>
                {variable.length === 0 && <p className="text-xs text-text-muted">No variable expenses tracked.</p>}
                {variable.map((e) => (
                  <div key={e.id} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span>{e.name}</span>
                    <span className="tnum">{formatCurrency(monthlyEquivalent(e))}</span>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
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

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Locking freezes this month's numbers in your history — they won't change even if you edit expenses
                  later.
                </p>
                <div className="card-purple space-y-2 p-4 text-sm">
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
        </Modal>
      )}
    </div>
  )
}

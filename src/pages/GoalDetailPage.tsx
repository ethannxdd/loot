import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Pause, Play, Sparkles, Target, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { GoalForm } from '@/components/goals/GoalForm'
import { PauseGoalModal } from '@/components/goals/PauseGoalModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Segmented } from '@/components/ui/Segmented'
import {
  useAddContribution,
  useDeleteContribution,
  useDeleteGoal,
  useGoal,
  useGoalContributions,
  useUpdateGoal,
} from '@/hooks/useGoals'
import { goalCategoryColor, goalCategoryIcon } from '@/lib/categories'
import { deadlineLabel, parseDateOnly, remainingAmount, requiredMonthlyContribution } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import { router } from '@/router'
import type { GoalContribution, NewGoal } from '@/lib/types'

export function GoalDetailPage({ goalId }: { goalId: string }) {
  const { data: goal, isLoading } = useGoal(goalId)
  const { data: contributions = [] } = useGoalContributions(goalId)
  const addContribution = useAddContribution()
  const deleteContribution = useDeleteContribution()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const [mode, setMode] = useState<'add' | 'withdraw'>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [entryToRemove, setEntryToRemove] = useState<GoalContribution | null>(null)
  const editFormRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (editOpen) editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editOpen])

  if (isLoading) return <div className="skeleton h-40 rounded-2xl" />

  if (!goal) {
    return (
      <div className="animate-enter mx-auto max-w-2xl space-y-6">
        <Link to="/goals" className="inline-flex items-center gap-1 text-[15px] font-medium text-primary">
          <ArrowLeft size={17} strokeWidth={2} />
          Goals
        </Link>
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-fill">
            <Target size={30} strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">This goal isn&apos;t here any more</h2>
            <p className="max-w-sm text-sm text-muted-foreground">It may have been deleted, or the link is out of date.</p>
          </div>
          <Link to="/goals" className="btn btn-primary">
            Back to goals
          </Link>
        </div>
      </div>
    )
  }

  const Icon = goalCategoryIcon(goal.category)
  const progress = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0
  const monthly = requiredMonthlyContribution(goal)
  const remaining = remainingAmount(goal)
  const isAuto = goal.progress_mode === 'auto'

  function handleSubmitAmount(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return toast.error('Enter an amount greater than zero.')
    if (mode === 'withdraw' && value > goal!.current_amount) {
      return toast.error(`You only have ${formatCurrency(goal!.current_amount)} saved in this goal.`)
    }
    addContribution.mutate(
      { goalId, amount: mode === 'withdraw' ? -value : value, note },
      {
        onSuccess: () => {
          setAmount('')
          setNote('')
          toast.success(mode === 'withdraw' ? `Took ${formatCurrency(value)} out` : `Added ${formatCurrency(value)}`)
        },
      },
    )
  }

  function handleEdit(values: NewGoal) {
    updateGoal.mutate(
      { id: goalId, patch: values },
      {
        onSuccess: () => {
          setEditOpen(false)
          toast.success('Goal updated')
        },
      },
    )
  }

  function handleDelete() {
    deleteGoal.mutate(goalId, {
      onSuccess: () => {
        toast.success(`${goal!.name} deleted`)
        void router.navigate({ to: '/goals' })
      },
    })
  }

  function handleResume() {
    updateGoal.mutate(
      { id: goalId, patch: { is_paused: false, resume_date: null } },
      { onSuccess: () => toast.success(`${goal!.name} resumed`) },
    )
  }

  function handlePause(resumeDate: string | null) {
    updateGoal.mutate(
      { id: goalId, patch: { is_paused: true, resume_date: resumeDate } },
      {
        onSuccess: () => {
          setPauseOpen(false)
          toast.success(`${goal!.name} paused`)
        },
      },
    )
  }

  function handleRemoveEntry() {
    if (!entryToRemove) return
    deleteContribution.mutate(entryToRemove, {
      onSuccess: () => {
        setEntryToRemove(null)
        toast.success('Entry removed and balance adjusted')
      },
    })
  }

  const resumeLabel = goal.resume_date
    ? parseDateOnly(goal.resume_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const color = goal.is_completed ? 'var(--accent)' : goal.is_paused ? 'var(--chart-7)' : goalCategoryColor(goal.category)
  const pct = Math.min(100, Math.round(progress * 100))
  const R = 52
  const C = 2 * Math.PI * R

  return (
    <div className="animate-enter mx-auto max-w-3xl space-y-6">
      <Link to="/goals" className="inline-flex items-center gap-1 text-[15px] font-medium text-primary">
        <ArrowLeft size={17} strokeWidth={2} />
        Goals
      </Link>

      <section className="card-elevated space-y-6 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-[128px] w-[128px] shrink-0 sm:mx-0">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--fill-2)" strokeWidth="12" />
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * C} ${C}`}
                className="transition-[stroke-dasharray] duration-700"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <span className="grid place-items-center" style={{ color }}>
                  <Icon size={20} strokeWidth={2.1} />
                </span>
                <span className="tnum block text-[24px] font-bold tracking-[-0.03em]">{pct}%</span>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="page-title !text-[30px]">{goal.name}</h1>
            {goal.note && <p className="mt-1 text-[15px] text-muted-foreground">{goal.note}</p>}
            <p className="tnum mt-3 text-[17px] font-semibold">
              {formatCurrency(goal.current_amount)}{' '}
              <span className="font-medium text-muted-foreground">of {formatCurrency(goal.target_amount)}</span>
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className={`chip ${goal.is_completed ? 'chip-positive' : goal.is_paused ? 'chip-neutral' : 'chip-neutral'}`}>
                {goal.is_completed
                  ? 'Completed'
                  : goal.is_paused
                    ? `Paused${resumeLabel ? ` · resumes ${resumeLabel}` : ''}`
                    : deadlineLabel(goal.target_date)}
              </span>
              {isAuto && (
                <span className="chip chip-positive">
                  <Sparkles size={12} strokeWidth={2.2} /> Auto-funded · weight {goal.weight}
                </span>
              )}
            </div>
          </div>
        </div>

        {!goal.is_completed && !goal.is_paused && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-[12.5px] text-muted-foreground">Still to go</p>
              <p className="tnum text-[20px] font-bold tracking-[-0.02em]">{formatCurrency(remaining)}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-[12.5px] text-muted-foreground">Needed each month</p>
              <p className="tnum text-[20px] font-bold tracking-[-0.02em]">
                {monthly > 0 ? formatCurrency(monthly) : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
          <button type="button" onClick={() => setEditOpen(true)} className="btn btn-ghost">
            Edit goal
          </button>
          {!goal.is_completed &&
            (goal.is_paused ? (
              <button type="button" onClick={handleResume} disabled={updateGoal.isPending} className="btn btn-ghost">
                <Play size={15} strokeWidth={2} /> Resume
              </button>
            ) : (
              <button type="button" onClick={() => setPauseOpen(true)} className="btn btn-ghost">
                <Pause size={15} strokeWidth={2} /> Pause
              </button>
            ))}
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-destructive sm:ml-auto">
            <Trash2 size={15} strokeWidth={2} /> Delete
          </button>
        </div>
      </section>

      {editOpen && (
        <section ref={editFormRef} className="card-elevated animate-enter scroll-mt-6 space-y-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">Edit goal</h2>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <GoalForm
            initial={goal}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
            isSubmitting={updateGoal.isPending}
            submitLabel="Save changes"
          />
        </section>
      )}

      <form onSubmit={handleSubmitAmount} className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="card-title">{mode === 'add' ? 'Add money' : 'Take money out'}</h2>
          <Segmented
            label="Contribution type"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'add', label: 'Add' },
              { value: 'withdraw', label: 'Withdraw' },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            aria-label="Amount"
          />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
          <button type="submit" disabled={addContribution.isPending} className="btn btn-primary shrink-0">
            {addContribution.isPending && <Loader2 size={16} className="animate-spin" />}
            {mode === 'add' ? 'Add' : 'Withdraw'}
          </button>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Loot only tracks this — move the money with your bank too.
        </p>
      </form>

      <section className="space-y-2">
        <h2 className="card-title px-1">History</h2>
        {contributions.length === 0 ? (
          <div className="card text-[14px] text-muted-foreground">Nothing logged yet.</div>
        ) : (
          <div className="card !px-4 !py-2">
            <div className="divide-y divide-hairline">
              {contributions.map((c) => (
                <div key={c.id} className="group flex items-center gap-3 py-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold ${
                      c.amount < 0 ? 'bg-caution/12 text-caution' : 'bg-primary/12 text-primary'
                    }`}
                  >
                    {c.amount < 0 ? '−' : '+'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">{c.note || (c.amount < 0 ? 'Withdrawal' : 'Contribution')}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`tnum text-[15px] font-semibold ${c.amount < 0 ? 'text-caution' : 'text-primary'}`}>
                    {c.amount < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(c.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEntryToRemove(c)}
                    aria-label="Remove entry"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert"
                  >
                    <Trash2 size={15} strokeWidth={1.9} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {pauseOpen && (
        <PauseGoalModal goal={goal} isPending={updateGoal.isPending} onConfirm={handlePause} onCancel={() => setPauseOpen(false)} />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this goal?"
          confirmLabel="Delete goal"
          isPending={deleteGoal.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        >
          <p>
            <span className="font-semibold text-foreground">{goal.name}</span> and its contribution history will be
            gone for good — this can't be undone.
          </p>
        </ConfirmModal>
      )}

      {entryToRemove && (
        <ConfirmModal
          title="Remove this entry?"
          confirmLabel="Remove entry"
          isPending={deleteContribution.isPending}
          onConfirm={handleRemoveEntry}
          onCancel={() => setEntryToRemove(null)}
        >
          <p>
            The {entryToRemove.amount < 0 ? 'withdrawal' : 'contribution'} of{' '}
            <span className="font-semibold text-foreground">{formatCurrency(Math.abs(entryToRemove.amount))}</span> will
            be removed and the goal's balance adjusted to match.
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}

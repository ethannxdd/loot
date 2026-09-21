import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Pause, Play, Sparkles, Target, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { GoalForm } from '@/components/goals/GoalForm'
import { PauseGoalModal } from '@/components/goals/PauseGoalModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import {
  useAddContribution,
  useDeleteContribution,
  useDeleteGoal,
  useGoal,
  useGoalContributions,
  useUpdateGoal,
} from '@/hooks/useGoals'
import { goalCategoryIcon } from '@/lib/categories'
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

  if (isLoading) return <div className="skeleton h-40 rounded-2xl" />

  if (!goal) {
    return (
      <div className="animate-enter mx-auto max-w-2xl space-y-6">
        <Link to="/goals" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} strokeWidth={1.75} />
          Back to goals
        </Link>
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Target size={32} strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">This goal isn't here any more.</h2>
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

  return (
    <div className="animate-enter mx-auto max-w-2xl space-y-6">
      <Link to="/goals" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} strokeWidth={1.75} />
        Back to goals
      </Link>

      <div className="card-elevated space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{goal.name}</h1>
            {goal.note && <p className="text-sm text-muted-foreground">{goal.note}</p>}
            {isAuto && (
              <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                <Sparkles size={12} strokeWidth={1.75} /> Auto-funded · weight {goal.weight}
              </p>
            )}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setEditOpen(true)} className="btn btn-ghost">
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete goal"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground hover:border-alert/30 hover:text-alert"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="tnum font-semibold">
              {formatCurrency(goal.current_amount)}{' '}
              <span className="font-normal text-text-muted">/ {formatCurrency(goal.target_amount)}</span>
            </span>
            <span className="text-text-muted">
              {goal.is_completed ? 'Completed 🎉' : deadlineLabel(goal.target_date)}
            </span>
          </div>
          {!goal.is_completed && !goal.is_paused && (
            <p className="text-xs text-text-muted">
              {formatCurrency(remaining)} to go
              {monthly > 0 && <> — needs {formatCurrency(monthly)}/month to hit its target date.</>}
            </p>
          )}
          {goal.is_paused && (
            <p className="text-xs text-text-muted">Paused{resumeLabel ? ` — resumes on ${resumeLabel}` : ''}.</p>
          )}
        </div>

        {!goal.is_completed && (
          <div>
            {goal.is_paused ? (
              <button type="button" onClick={handleResume} disabled={updateGoal.isPending} className="btn btn-ghost">
                <Play size={14} strokeWidth={1.75} /> Resume goal
              </button>
            ) : (
              <button type="button" onClick={() => setPauseOpen(true)} className="btn btn-ghost">
                <Pause size={14} strokeWidth={1.75} /> Pause goal
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmitAmount} className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="overline">{mode === 'add' ? 'Add money' : 'Take money out'}</div>
          <div className="flex gap-1 rounded-[10px] border border-border bg-input p-1 text-xs font-semibold">
            <button
              type="button"
              aria-pressed={mode === 'add'}
              onClick={() => setMode('add')}
              className={`rounded-lg px-3 py-1.5 ${mode === 'add' ? 'bg-surface-3 text-foreground' : 'text-text-muted'}`}
            >
              Add
            </button>
            <button
              type="button"
              aria-pressed={mode === 'withdraw'}
              onClick={() => setMode('withdraw')}
              className={`rounded-lg px-3 py-1.5 ${mode === 'withdraw' ? 'bg-surface-3 text-foreground' : 'text-text-muted'}`}
            >
              Withdraw
            </button>
          </div>
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
      </form>

      <div className="space-y-2">
        <div className="overline px-1">History</div>
        {contributions.length === 0 ? (
          <p className="px-1 text-sm text-text-muted">Nothing logged yet.</p>
        ) : (
          <div className="card space-y-1">
            {contributions.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {c.note && <p className="truncate text-xs text-text-muted">{c.note}</p>}
                </div>
                <span className={`tnum text-sm font-semibold ${c.amount < 0 ? 'text-caution' : 'text-primary'}`}>
                  {c.amount < 0 ? '−' : '+'}
                  {formatCurrency(Math.abs(c.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => setEntryToRemove(c)}
                  aria-label="Remove entry"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editOpen && (
        <Modal title="Edit goal" onClose={() => setEditOpen(false)}>
          <GoalForm
            initial={goal}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
            isSubmitting={updateGoal.isPending}
            submitLabel="Save changes"
          />
        </Modal>
      )}

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

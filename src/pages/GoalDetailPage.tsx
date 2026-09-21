import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { GoalForm } from '@/components/goals/GoalForm'
import { Modal } from '@/components/ui/Modal'
import {
  useAddContribution,
  useDeleteGoal,
  useGoal,
  useGoalContributions,
  useUpdateGoal,
} from '@/hooks/useGoals'
import { goalCategoryIcon } from '@/lib/categories'
import { monthsUntil, requiredMonthlyContribution } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import { router } from '@/router'
import type { NewGoal } from '@/lib/types'

export function GoalDetailPage({ goalId }: { goalId: string }) {
  const { data: goal, isLoading } = useGoal(goalId)
  const { data: contributions = [] } = useGoalContributions(goalId)
  const addContribution = useAddContribution()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const [contributionAmount, setContributionAmount] = useState('')
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading || !goal) {
    return <div className="skeleton h-40 rounded-2xl" />
  }

  const Icon = goalCategoryIcon(goal.category)
  const progress = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0
  const monthly = requiredMonthlyContribution(goal)
  const months = monthsUntil(goal.target_date)

  function handleContribute(e: FormEvent) {
    e.preventDefault()
    if (!contributionAmount) return
    addContribution.mutate(
      { goalId, amount: Number(contributionAmount) },
      { onSuccess: () => setContributionAmount('') },
    )
  }

  function handleEdit(values: NewGoal) {
    updateGoal.mutate({ id: goalId, patch: values }, { onSuccess: () => setEditOpen(false) })
  }

  function handleDelete() {
    deleteGoal.mutate(goalId, { onSuccess: () => router.navigate({ to: '/goals' }) })
  }

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
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setEditOpen(true)} className="btn btn-ghost">
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete goal"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground hover:border-alert/30 hover:text-alert"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="tnum font-semibold">
              {formatCurrency(goal.current_amount)}{' '}
              <span className="font-normal text-text-muted">
                / {formatCurrency(goal.target_amount)}
              </span>
            </span>
            <span className="text-text-muted">
              {months !== null ? `${months} months left` : 'No deadline'}
            </span>
          </div>
          {!goal.is_completed && !goal.is_paused && monthly > 0 && (
            <p className="text-xs text-text-muted">
              Needs {formatCurrency(monthly)}/month to hit its target.
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="overline">Add a contribution</div>
        <form onSubmit={handleContribute} className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value)}
            placeholder="Amount"
          />
          <button type="submit" disabled={addContribution.isPending} className="btn btn-primary shrink-0">
            {addContribution.isPending && <Loader2 size={16} className="animate-spin" />}
            Add
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <div className="overline px-1">Contribution history</div>
        {contributions.length === 0 ? (
          <p className="px-1 text-sm text-text-muted">No contributions logged yet.</p>
        ) : (
          <div className="card space-y-1">
            {contributions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-[10px] px-2 py-2">
                <span className="text-sm text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="tnum text-sm font-semibold text-primary">
                  +{formatCurrency(c.amount)}
                </span>
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
    </div>
  )
}

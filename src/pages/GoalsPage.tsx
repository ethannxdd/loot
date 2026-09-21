import { Plus, Target } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalForm } from '@/components/goals/GoalForm'
import { Modal } from '@/components/ui/Modal'
import { useExpenses } from '@/hooks/useExpenses'
import { useCreateGoal, useGoals, useReorderGoals, useUpdateGoal } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { commitmentStatus, commitmentTimeline, requiredMonthlyContribution, shortfallSuggestions } from '@/lib/goal-math'
import { disposableIncome } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { NewGoal } from '@/lib/types'

const STATUS_META = {
  comfortable: { label: 'Comfortable', className: 'text-primary bg-primary/10 border-primary/30' },
  tight: { label: 'Tight', className: 'text-caution bg-caution/10 border-caution/30' },
  'not-feasible': { label: 'Not feasible', className: 'text-alert bg-alert/10 border-alert/30' },
}

export function GoalsPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [] } = useGoals()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const reorderGoals = useReorderGoals()

  const [addOpen, setAddOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const disposable = profile ? disposableIncome(profile.net_income, expenses) : 0
  const totalCommitment = useMemo(
    () => goals.reduce((sum, g) => sum + requiredMonthlyContribution(g), 0),
    [goals],
  )
  const status = commitmentStatus(totalCommitment, disposable)
  const timeline = useMemo(() => commitmentTimeline(goals), [goals])
  const shortfall = Math.max(0, totalCommitment - disposable)
  const suggestions = useMemo(
    () => (shortfall > 0 ? shortfallSuggestions(goals, shortfall) : []),
    [goals, shortfall],
  )

  function handleCreate(values: NewGoal) {
    createGoal.mutate(
      { ...values, sort_order: goals.length },
      { onSuccess: () => setAddOpen(false) },
    )
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const reordered = [...goals]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setDragIndex(null)
    reorderGoals.mutate(reordered.map((g) => g.id))
  }

  function useSuggestedOrder() {
    const sorted = [...goals].sort((a, b) => {
      if (!a.target_date) return 1
      if (!b.target_date) return -1
      return a.target_date.localeCompare(b.target_date)
    })
    reorderGoals.mutate(sorted.map((g) => g.id))
  }

  if (goals.length === 0) {
    return (
      <div className="animate-enter space-y-6">
        <PageHeader onAdd={() => setAddOpen(true)} />
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Target size={32} strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">No goals yet.</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Set a savings goal and Loot will tell you whether it's comfortable given what you
              have left each month.
            </p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary">
            Add a goal
          </button>
        </div>
        {addOpen && (
          <Modal title="New goal" onClose={() => setAddOpen(false)}>
            <GoalForm
              onSubmit={handleCreate}
              onCancel={() => setAddOpen(false)}
              isSubmitting={createGoal.isPending}
            />
          </Modal>
        )}
      </div>
    )
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader onAdd={() => setAddOpen(true)} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="overline">Your goals</span>
            <button type="button" onClick={useSuggestedOrder} className="text-xs font-semibold text-primary">
              Use suggested order
            </button>
          </div>
          {goals.map((goal, index) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              onTogglePause={() =>
                updateGoal.mutate({ id: goal.id, patch: { is_paused: !goal.is_paused } })
              }
            />
          ))}
        </div>

        <div className="space-y-5">
          <div className="card-elevated space-y-3">
            <div className="overline">Combined impact</div>
            <div>
              <p className="tnum text-2xl">{formatCurrency(totalCommitment)}</p>
              <p className="text-xs text-text-muted">of {formatCurrency(disposable)} disposable</p>
            </div>
            <span
              className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_META[status].className}`}
            >
              {STATUS_META[status].label}
            </span>
          </div>

          {suggestions.length > 0 && (
            <div className="card space-y-3">
              <div className="overline text-alert">Shortfall</div>
              <p className="text-xs text-muted-foreground">
                Your goals need {formatCurrency(shortfall)} more than you have disposable each
                month.
              </p>
              <ul className="space-y-2">
                {suggestions.map(({ goal, suggestion }) => (
                  <li key={goal.id} className="text-xs text-muted-foreground">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="overline mb-3">24-month commitment</div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                    interval={3}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{
                      background: '#211B1B',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" fill="#AF72FE" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {addOpen && (
        <Modal title="New goal" onClose={() => setAddOpen(false)}>
          <GoalForm
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            isSubmitting={createGoal.isPending}
          />
        </Modal>
      )}
    </div>
  )
}

function PageHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What you're saving for, and whether it's realistic.
        </p>
      </div>
      <button type="button" onClick={onAdd} className="btn btn-primary">
        <Plus size={16} strokeWidth={2} />
        Add goal
      </button>
    </header>
  )
}

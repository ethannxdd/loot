import { Link } from '@tanstack/react-router'
import { Plus, Sparkles, Target, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { toast } from 'sonner'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalForm } from '@/components/goals/GoalForm'
import { PauseGoalModal } from '@/components/goals/PauseGoalModal'
import { useExpenses } from '@/hooks/useExpenses'
import { useAutoAllocation } from '@/hooks/useAutoAllocation'
import {
  useApplyAutoContribution,
  useCreateGoal,
  useGoals,
  useReorderGoals,
  useUpdateGoal,
} from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import {
  commitmentStatus,
  commitmentTimeline,
  displayOrder,
  requiredMonthlyContribution,
  shortfallSuggestions,
  suggestedOrder,
  type TimelineMonth,
} from '@/lib/goal-math'
import { disposableIncome } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { NewGoal, SavingsGoal } from '@/lib/types'

const STATUS_META = {
  comfortable: { label: 'Comfortable', className: 'text-primary bg-primary/10 border-primary/30' },
  tight: { label: 'Tight', className: 'text-caution bg-caution/10 border-caution/30' },
  'not-feasible': { label: 'Not feasible', className: 'text-alert bg-alert/10 border-alert/30' },
}

const TIMING_TEXT = {
  on_demand: 'Press Apply on a goal to add its share.',
  monthly_1st: 'Shares are added automatically the first time you open Loot each month.',
  estimate_only: 'Estimates only — nothing is added for you.',
}

function TimelineTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as TimelineMonth | undefined
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{row.month}</p>
      <p className="tnum text-muted-foreground">{formatCurrency(row.total)} needed</p>
      {row.completing.length > 0 && <p className="mt-1 text-primary">Finishes: {row.completing.join(', ')}</p>}
    </div>
  )
}

export function GoalsPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [], isLoading } = useGoals()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const reorderGoals = useReorderGoals()
  const applyAuto = useApplyAutoContribution()
  const auto = useAutoAllocation()

  const [addOpen, setAddOpen] = useState(false)
  const [pauseTarget, setPauseTarget] = useState<SavingsGoal | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const addFormRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (addOpen) addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [addOpen])

  const ordered = useMemo(() => displayOrder(goals), [goals])
  const disposable = profile ? disposableIncome(profile.net_income, expenses) : 0
  const totalCommitment = useMemo(() => goals.reduce((sum, g) => sum + requiredMonthlyContribution(g), 0), [goals])
  const status = commitmentStatus(totalCommitment, disposable)
  const timeline = useMemo(() => commitmentTimeline(goals), [goals])
  const shortfall = Math.max(0, totalCommitment - disposable)
  const suggestions = useMemo(() => (shortfall > 0 ? shortfallSuggestions(goals, shortfall) : []), [goals, shortfall])
  const hasAutoGoals = goals.some((g) => g.progress_mode === 'auto' && !g.is_completed && !g.is_paused)
  const chartHasData = timeline.some((m) => m.total > 0)

  function handleCreate(values: NewGoal) {
    createGoal.mutate(
      { ...values, sort_order: goals.length },
      {
        onSuccess: () => {
          setAddOpen(false)
          toast.success(`${values.name} created`)
        },
      },
    )
  }

  function saveOrder(next: SavingsGoal[]) {
    reorderGoals.mutate(next.map((g) => g.id))
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const reordered = [...ordered]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setDragIndex(null)
    saveOrder(reordered)
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta
    if (to < 0 || to >= ordered.length) return
    const reordered = [...ordered]
    ;[reordered[index], reordered[to]] = [reordered[to], reordered[index]]
    saveOrder(reordered)
  }

  function applySuggestedOrder() {
    saveOrder(suggestedOrder(goals))
    toast.success('Goals sorted by soonest deadline')
  }

  function togglePause(goal: SavingsGoal) {
    if (goal.is_paused) {
      updateGoal.mutate(
        { id: goal.id, patch: { is_paused: false, resume_date: null } },
        { onSuccess: () => toast.success(`${goal.name} resumed`) },
      )
    } else {
      setPauseTarget(goal)
    }
  }

  function confirmPause(resumeDate: string | null) {
    if (!pauseTarget) return
    const goal = pauseTarget
    updateGoal.mutate(
      { id: goal.id, patch: { is_paused: true, resume_date: resumeDate } },
      {
        onSuccess: () => {
          setPauseTarget(null)
          toast.success(`${goal.name} paused`)
        },
      },
    )
  }

  function apply(goal: SavingsGoal) {
    setApplyingId(goal.id)
    applyAuto.mutate(
      { goalId: goal.id, amount: auto.shares[goal.id] ?? 0 },
      {
        onSuccess: (result) => {
          if (result.applied) toast.success(`Added your ${goal.name} share`)
          else toast(`${goal.name} was already topped up this month`)
        },
        onSettled: () => setApplyingId(null),
      },
    )
  }

  const addGoalSection = addOpen && (
    <section ref={addFormRef} className="card-elevated animate-enter space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">New goal</h2>
        <button
          type="button"
          onClick={() => setAddOpen(false)}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <GoalForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} isSubmitting={createGoal.isPending} />
    </section>
  )

  const pauseModal = pauseTarget && (
    <PauseGoalModal
      goal={pauseTarget}
      isPending={updateGoal.isPending}
      onConfirm={confirmPause}
      onCancel={() => setPauseTarget(null)}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader onAdd={() => setAddOpen(true)} />
        {addGoalSection}
        <div className="skeleton h-40 rounded-2xl" />
        {pauseModal}
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="animate-enter space-y-6">
        <PageHeader onAdd={() => setAddOpen(true)} />
        {addGoalSection}
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Target size={32} strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">No goals yet.</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Set a savings goal and Loot will tell you whether it's comfortable given what you have left each month.
            </p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary">
            Add a goal
          </button>
        </div>
        {pauseModal}
      </div>
    )
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader onAdd={() => setAddOpen(true)} />
      {addGoalSection}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="overline-label">Your goals</span>
            {goals.length > 1 && (
              <button type="button" onClick={applySuggestedOrder} className="text-xs font-semibold text-primary">
                Use suggested order
              </button>
            )}
          </div>

          {hasAutoGoals && auto.ready && (
            <div className="card flex items-start gap-3">
              <Sparkles size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0 text-xs text-muted-foreground">
                <p>
                  <span className="tnum font-semibold text-foreground">{formatCurrency(auto.pool)}</span> spare loot this
                  month (disposable income after your safety buffer), split{' '}
                  {auto.mode === 'sequential' ? 'in priority order' : 'by share weight'}. {TIMING_TEXT[auto.timing]}{' '}
                  <Link to="/settings" className="font-semibold text-primary">
                    Change in Settings
                  </Link>
                </p>
              </div>
            </div>
          )}

          {ordered.map((goal, index) => {
            const prev = ordered[index - 1]
            const next = ordered[index + 1]
            const movable = !goal.is_completed
            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                draggable={movable}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e: DragEvent) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onMoveUp={movable && prev && !prev.is_completed ? () => move(index, -1) : undefined}
                onMoveDown={movable && next && !next.is_completed ? () => move(index, 1) : undefined}
                onTogglePause={() => togglePause(goal)}
                autoShare={goal.progress_mode === 'auto' && auto.ready ? (auto.shares[goal.id] ?? 0) : undefined}
                autoApplied={auto.applied[goal.id] ?? 0}
                canApply={auto.timing === 'on_demand'}
                onApply={() => apply(goal)}
                isApplying={applyingId === goal.id}
              />
            )
          })}
        </div>

        <div className="space-y-5">
          <div className="card-elevated space-y-3">
            <div className="overline-label">Combined impact</div>
            <div>
              <p className="tnum text-2xl">{formatCurrency(totalCommitment)}</p>
              <p className="text-xs text-text-muted">
                a month needed, of {formatCurrency(Math.max(0, disposable))} disposable
              </p>
            </div>
            <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_META[status].className}`}>
              {STATUS_META[status].label}
            </span>
            <p className="text-xs text-text-muted">Counts goals with a target date; goals without one don't need a fixed amount.</p>
          </div>

          {suggestions.length > 0 && (
            <div className="card space-y-3">
              <div className="overline-label text-alert">Shortfall</div>
              <p className="text-xs text-muted-foreground">
                Your goals need {formatCurrency(shortfall)} more than you have disposable each month.
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
            <div className="overline-label mb-3">24-month commitment</div>
            {chartHasData ? (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                      interval={3}
                      padding={{ left: 12, right: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={(props) => <TimelineTooltip active={props.active} payload={props.payload} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="total" fill="#AF72FE" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Give a goal a target date and its monthly commitment shows up here.</p>
            )}
          </div>
        </div>
      </div>

      {pauseModal}
    </div>
  )
}

function PageHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">What you're saving for, and whether it's realistic.</p>
      </div>
      <button type="button" onClick={onAdd} className="btn btn-primary">
        <Plus size={16} strokeWidth={2} />
        Add goal
      </button>
    </header>
  )
}

import { Link } from '@tanstack/react-router'
import { Plus, Sparkles, Target, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { toast } from 'sonner'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalForm } from '@/components/goals/GoalForm'
import { PauseGoalModal } from '@/components/goals/PauseGoalModal'
import { PageHeader } from '@/components/ui/PageHeader'
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
  comfortable: { label: 'Comfortable', className: 'chip-positive' },
  tight: { label: 'Tight', className: 'chip-caution' },
  'not-feasible': { label: 'Not feasible', className: 'chip-alert' },
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
    <div className="rounded-xl bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
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
  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

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

  const header = (
    <PageHeader
      eyebrow="Money"
      title="Goals"
      subtitle="What you're saving for, and whether it's realistic."
      actions={
        <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary" data-tutorial="goals-add">
          <Plus size={16} strokeWidth={2.4} />
          Add goal
        </button>
      }
    />
  )

  const addGoalSection = addOpen && (
    <section ref={addFormRef} className="card-elevated animate-enter scroll-mt-6 space-y-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">New goal</h2>
        <button
          type="button"
          onClick={() => setAddOpen(false)}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <div className="max-w-2xl">
        <GoalForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} isSubmitting={createGoal.isPending} />
      </div>
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
        {header}
        {addGoalSection}
        <div className="skeleton h-40 rounded-2xl" />
        {pauseModal}
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="animate-enter space-y-6">
        {header}
        {addGoalSection}
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
            <Target size={30} strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">No goals yet</h2>
            <p className="max-w-sm text-[14px] text-muted-foreground">
              Set a savings goal and Loot will tell you whether it's comfortable given what you have left each month.
            </p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary">
            <Plus size={16} strokeWidth={2.4} /> Add your first goal
          </button>
        </div>
        {pauseModal}
      </div>
    )
  }

  return (
    <div className="animate-enter space-y-6">
      {header}
      {addGoalSection}

      <section className="card-elevated grid gap-6 sm:grid-cols-3 sm:p-6">
        <div className="sm:col-span-1">
          <p className="text-[13px] font-medium text-muted-foreground">Saved across {goals.length} goal{goals.length === 1 ? '' : 's'}</p>
          <p className="tnum mt-1 text-[40px] font-bold leading-none tracking-[-0.04em]">{formatCurrency(totalSaved)}</p>
          <p className="tnum mt-2 text-[13px] text-muted-foreground">
            of {formatCurrency(totalTarget)} · {Math.round(overallPct)}% of the way
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, overallPct)}%` }} />
          </div>
        </div>
        <div className="border-hairline sm:col-span-2 sm:border-l sm:pl-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">Needed each month</p>
              <p className="tnum mt-1 text-[28px] font-bold tracking-[-0.03em]">{formatCurrency(totalCommitment)}</p>
              <p className="tnum text-[13px] text-muted-foreground">
                of {formatCurrency(Math.max(0, disposable))} you have available
              </p>
            </div>
            <span className={`chip ${STATUS_META[status].className}`}>{STATUS_META[status].label}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-fill">
            <span
              className={`block h-full rounded-full ${status === 'not-feasible' ? 'bg-alert' : status === 'tight' ? 'bg-caution' : 'bg-primary'}`}
              style={{ width: `${Math.min(100, (totalCommitment / Math.max(disposable, 1)) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-text-subtle">
            Counts goals with a target date; goals without one don&apos;t need a fixed amount.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between px-1">
            <h2 className="card-title">Your goals</h2>
            {goals.length > 1 && (
              <button type="button" onClick={applySuggestedOrder} className="text-[13px] font-semibold text-primary">
                Sort by deadline
              </button>
            )}
          </div>

          {hasAutoGoals && auto.ready && (
            <div className="card-purple flex items-start gap-3 p-4">
              <Sparkles size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-primary" />
              <p className="min-w-0 text-[13px] text-muted-foreground">
                <span className="tnum font-semibold text-foreground">{formatCurrency(auto.pool)}</span> spare loot this month
                (disposable income after your safety buffer), split{' '}
                {auto.mode === 'sequential' ? 'in priority order' : 'by share weight'}. {TIMING_TEXT[auto.timing]}{' '}
                <Link to="/settings" className="font-semibold text-primary">
                  Change in Settings
                </Link>
              </p>
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

        <div className="space-y-4 lg:col-span-5 lg:pt-9">
          {suggestions.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <span className="chip chip-alert">Shortfall</span>
                <span className="tnum text-[13px] font-semibold">{formatCurrency(shortfall)} / month</span>
              </div>
              <p className="text-[13px] text-muted-foreground">
                Your goals need more than you have available each month. Some ways to close the gap:
              </p>
              <ul className="space-y-2">
                {suggestions.map(({ goal, suggestion }) => (
                  <li key={goal.id} className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="card-title">Next 24 months</h3>
              <span className="text-[12.5px] text-muted-foreground">Monthly commitment</span>
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">How much your dated goals ask for each month, as they finish.</p>
            {chartHasData ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'var(--label-2)' }}
                      interval={5}
                      padding={{ left: 8, right: 8 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={(props) => <TimelineTooltip active={props.active} payload={props.payload} />} cursor={{ fill: 'var(--fill)' }} />
                    <Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">Give a goal a target date and its monthly commitment shows up here.</p>
            )}
          </div>
        </div>
      </div>

      {pauseModal}
    </div>
  )
}

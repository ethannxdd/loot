import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, GripVertical, Loader2, Pause, Play, Sparkles } from 'lucide-react'
import type { DragEvent } from 'react'
import { goalCategoryColor, goalCategoryIcon } from '@/lib/categories'
import { deadlineLabel, parseDateOnly, requiredMonthlyContribution } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import type { SavingsGoal } from '@/lib/types'

interface GoalCardProps {
  goal: SavingsGoal
  onTogglePause: () => void
  /** This month's suggested share for an auto goal (undefined for manual goals). */
  autoShare?: number
  /** Already paid to this goal this month by auto-funding. */
  autoApplied?: number
  /** Show an "Apply" button for the share (timing = on demand). */
  canApply?: boolean
  onApply?: () => void
  isApplying?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
}

export function GoalCard({
  goal,
  onTogglePause,
  autoShare,
  autoApplied = 0,
  canApply,
  onApply,
  isApplying,
  onMoveUp,
  onMoveDown,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: GoalCardProps) {
  const Icon = goalCategoryIcon(goal.category)
  const progress = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0
  const monthly = requiredMonthlyContribution(goal)
  const overdue = !goal.is_completed && deadlineLabel(goal.target_date) === 'Overdue'
  const isAuto = goal.progress_mode === 'auto'
  const resumeLabel = goal.resume_date
    ? parseDateOnly(goal.resume_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const color = goal.is_completed ? 'var(--accent)' : goal.is_paused ? 'var(--chart-7)' : goalCategoryColor(goal.category)
  const pct = Math.min(100, Math.round(progress * 100))
  const iconBtn =
    'grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-fill hover:text-foreground'

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`card group space-y-4 ${goal.is_completed ? 'opacity-85' : ''}`}
    >
      <div className="flex items-center gap-3">
        {draggable && (
          <GripVertical size={16} className="-ml-1 hidden shrink-0 cursor-grab text-text-subtle [@media(hover:hover)]:block" />
        )}
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] text-white" style={{ background: color }}>
          <Icon size={19} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <Link to="/goals/$goalId" params={{ goalId: goal.id }} className="block">
            <p className="truncate text-[16px] font-semibold tracking-[-0.01em] hover:text-primary">{goal.name}</p>
          </Link>
          {goal.is_completed ? (
            <p className="text-[13px] font-semibold text-primary">Completed</p>
          ) : goal.is_paused ? (
            <p className="text-[13px] text-muted-foreground">{resumeLabel ? `Paused · resumes ${resumeLabel}` : 'Paused'}</p>
          ) : (
            <p className={`text-[13px] ${overdue ? 'font-semibold text-caution' : 'text-muted-foreground'}`}>
              {deadlineLabel(goal.target_date)}
              {isAuto && ' · Auto-funded'}
            </p>
          )}
        </div>
        <span className="tnum text-[22px] font-bold tracking-[-0.03em]" style={{ color: goal.is_completed ? 'var(--accent)' : undefined }}>
          {pct}%
        </span>
      </div>

      <div className="space-y-2">
        <div className="h-2.5 overflow-hidden rounded-full bg-fill">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="tnum font-semibold">
            {formatCurrency(goal.current_amount)}{' '}
            <span className="font-medium text-muted-foreground">of {formatCurrency(goal.target_amount)}</span>
          </span>
          {!goal.is_completed && !goal.is_paused && monthly > 0 && (
            <span className="tnum text-muted-foreground">{formatCurrency(monthly)} / month</span>
          )}
        </div>
      </div>

      {isAuto && !goal.is_completed && !goal.is_paused && autoShare !== undefined && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Sparkles size={14} strokeWidth={2} className="text-primary" />
            {autoApplied > 0
              ? `${formatCurrency(autoApplied)} added this month`
              : autoShare > 0
                ? `Your share this month: ${formatCurrency(autoShare)}`
                : 'No spare loot to share this month'}
          </span>
          {canApply && autoApplied === 0 && autoShare > 0 && (
            <button type="button" onClick={onApply} disabled={isApplying} className="btn btn-accent !min-h-8 !px-3.5 !text-[13px]">
              {isApplying && <Loader2 size={12} className="animate-spin" />}
              Apply
            </button>
          )}
        </div>
      )}

      {(onMoveUp || onMoveDown || !goal.is_completed) && (
        <div className="-mb-2 flex items-center justify-between border-t border-hairline pt-2">
          <Link
            to="/goals/$goalId"
            params={{ goalId: goal.id }}
            className="text-[13px] font-semibold text-primary"
          >
            Details &amp; contributions
          </Link>
          <div className="flex items-center">
            {onMoveUp && (
              <button type="button" onClick={onMoveUp} aria-label={`Move ${goal.name} up`} className={iconBtn}>
                <ArrowUp size={15} strokeWidth={2} />
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={onMoveDown} aria-label={`Move ${goal.name} down`} className={iconBtn}>
                <ArrowDown size={15} strokeWidth={2} />
              </button>
            )}
            {!goal.is_completed && (
              <button
                type="button"
                onClick={onTogglePause}
                aria-label={goal.is_paused ? `Resume ${goal.name}` : `Pause ${goal.name}`}
                title={goal.is_paused ? 'Resume' : 'Pause'}
                className={iconBtn}
              >
                {goal.is_paused ? <Play size={15} strokeWidth={2} /> : <Pause size={15} strokeWidth={2} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

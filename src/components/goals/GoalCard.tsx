import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, GripVertical, Loader2, Pause, Play, Sparkles } from 'lucide-react'
import type { DragEvent } from 'react'
import { goalCategoryIcon } from '@/lib/categories'
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

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`card card-hover space-y-3 ${goal.is_completed ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        {draggable && <GripVertical size={16} className="mt-1 hidden shrink-0 cursor-grab text-text-subtle sm:block" />}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <Link to="/goals/$goalId" params={{ goalId: goal.id }} className="block">
            <p className="truncate text-base font-bold hover:text-primary">{goal.name}</p>
          </Link>
          {goal.is_completed ? (
            <p className="text-xs font-semibold text-primary">Completed 🎉</p>
          ) : goal.is_paused ? (
            <p className="text-xs text-text-muted">{resumeLabel ? `Paused · resumes ${resumeLabel}` : 'Paused'}</p>
          ) : (
            <p className={`text-xs ${overdue ? 'text-caution' : 'text-text-muted'}`}>
              {deadlineLabel(goal.target_date)}
              {isAuto && ' · Auto'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              aria-label={`Move ${goal.name} up`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <ArrowUp size={14} strokeWidth={1.75} />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              aria-label={`Move ${goal.name} down`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <ArrowDown size={14} strokeWidth={1.75} />
            </button>
          )}
          {!goal.is_completed && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={goal.is_paused ? `Resume ${goal.name}` : `Pause ${goal.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              {goal.is_paused ? <Play size={14} strokeWidth={1.75} /> : <Pause size={14} strokeWidth={1.75} />}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="tnum font-semibold">
            {formatCurrency(goal.current_amount)}{' '}
            <span className="font-normal text-text-muted">/ {formatCurrency(goal.target_amount)}</span>
          </span>
          {!goal.is_completed && !goal.is_paused && monthly > 0 && (
            <span className="text-text-muted">{formatCurrency(monthly)}/mo needed</span>
          )}
        </div>
      </div>

      {isAuto && !goal.is_completed && !goal.is_paused && autoShare !== undefined && (
        <div className="flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.04] px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Sparkles size={13} strokeWidth={1.75} className="text-primary" />
            {autoApplied > 0
              ? `${formatCurrency(autoApplied)} added this month`
              : autoShare > 0
                ? `Your share this month: ${formatCurrency(autoShare)}`
                : 'No spare loot to share this month'}
          </span>
          {canApply && autoApplied === 0 && autoShare > 0 && (
            <button type="button" onClick={onApply} disabled={isApplying} className="btn btn-ghost !h-7 !px-3 text-xs">
              {isApplying && <Loader2 size={12} className="animate-spin" />}
              Apply
            </button>
          )}
        </div>
      )}
    </div>
  )
}

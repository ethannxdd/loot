import { Link } from '@tanstack/react-router'
import { GripVertical, Pause, Play } from 'lucide-react'
import type { DragEvent } from 'react'
import { goalCategoryIcon } from '@/lib/categories'
import { monthsUntil, requiredMonthlyContribution } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import type { SavingsGoal } from '@/lib/types'

interface GoalCardProps {
  goal: SavingsGoal
  onTogglePause: () => void
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
}

export function GoalCard({
  goal,
  onTogglePause,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: GoalCardProps) {
  const Icon = goalCategoryIcon(goal.category)
  const progress = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0
  const monthly = requiredMonthlyContribution(goal)
  const months = monthsUntil(goal.target_date)

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="card card-hover space-y-3"
    >
      <div className="flex items-start gap-3">
        {draggable && (
          <GripVertical size={16} className="mt-1 shrink-0 cursor-grab text-text-subtle" />
        )}
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
            <p className="text-xs text-text-muted">Paused</p>
          ) : (
            <p className="text-xs text-text-muted">
              {months !== null ? `${months} month${months === 1 ? '' : 's'} left` : 'No deadline'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={goal.is_paused ? 'Resume' : 'Pause'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          {goal.is_paused ? (
            <Play size={14} strokeWidth={1.75} />
          ) : (
            <Pause size={14} strokeWidth={1.75} />
          )}
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="tnum font-semibold">
            {formatCurrency(goal.current_amount)}{' '}
            <span className="font-normal text-text-muted">
              / {formatCurrency(goal.target_amount)}
            </span>
          </span>
          {!goal.is_completed && !goal.is_paused && monthly > 0 && (
            <span className="text-text-muted">{formatCurrency(monthly)}/mo needed</span>
          )}
        </div>
      </div>
    </div>
  )
}

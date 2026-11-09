import { Compass } from 'lucide-react'
import { GOAL_MANAGER_LABELS, type GoalManager } from '@/lib/goal-math'

/** "Target set by Northbound" — the goal's target and date are kept in step by another app. */
export function ManagedGoalBadge({ manager, className = '' }: { manager: GoalManager; className?: string }) {
  const name = GOAL_MANAGER_LABELS[manager]
  return (
    <span
      className={`chip chip-neutral ${className}`}
      title={`${name} sets this goal's target and date. Your savings are yours.`}
    >
      <Compass size={12} strokeWidth={2.2} aria-hidden="true" /> Target set by {name}
    </span>
  )
}


import { getCalendarWithCountdowns } from './tax/calendar'
import { currentMonthKey, monthLabel } from './money'
import type {
  BudgeScore,
  Expense,
  MonthlySnapshot,
  NewNotificationCandidate,
  SavingsGoal,
  SubscriptionReview,
  TaxProfile,
} from './types'

/** A notification not yet persisted — `dedupe_key` makes re-generation idempotent. */
export type { NewNotificationCandidate }

function daysUntilDueThisMonth(dueDay: number, from = new Date()): number {
  const due = new Date(from.getFullYear(), from.getMonth(), dueDay)
  return Math.ceil((due.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

/** Upcoming debits — expenses due within their own notify lead time (Business default 7 days on Dashboard). */
function upcomingDebitNotifications(expenses: Expense[], from = new Date()): NewNotificationCandidate[] {
  const month = currentMonthKey(from)
  return expenses
    .filter((e) => !e.deleted_at && e.notify_enabled && e.due_day)
    .map((e) => {
      const days = daysUntilDueThisMonth(e.due_day as number, from)
      if (days < 0 || days > e.notify_lead_days) return null
      const candidate: NewNotificationCandidate = {
        kind: 'upcoming_debit',
        title: `${e.name} due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
        body: `${e.name} is due on the ${e.due_day}${ordinalSuffix(e.due_day as number)}.`,
        link: '/expenses',
        dedupe_key: `upcoming_debit:${e.id}:${month}`,
      }
      return candidate
    })
    .filter((n): n is NewNotificationCandidate => n !== null)
}

function ordinalSuffix(n: number) {
  if (n % 10 === 1 && n !== 11) return 'st'
  if (n % 10 === 2 && n !== 12) return 'nd'
  if (n % 10 === 3 && n !== 13) return 'rd'
  return 'th'
}

/** Tax filing deadlines at the 60- and 30-day marks, per LOOT-FEATURES.md's Tax Calendar spec. */
function taxDeadlineNotifications(taxProfile: TaxProfile | null, from = new Date()): NewNotificationCandidate[] {
  if (!taxProfile) return []
  const entries = getCalendarWithCountdowns(from)
  const results: NewNotificationCandidate[] = []
  for (const entry of entries) {
    if (entry.daysUntil === 60 || entry.daysUntil === 30) {
      results.push({
        kind: 'tax_deadline',
        title: `${entry.label} in ${entry.daysUntil} days`,
        body: entry.description,
        link: '/tax',
        dedupe_key: `tax_deadline:${entry.id}:${entry.daysUntil}`,
      })
    }
  }
  return results
}

/** Subscriptions flagged for cancellation that are still showing as active. */
function subscriptionNotifications(reviews: SubscriptionReview[]): NewNotificationCandidate[] {
  return reviews
    .filter((r) => r.marked_cancel)
    .map((r) => ({
      kind: 'subscription_anomaly' as const,
      title: `Still paying for ${r.service_name}?`,
      body: `You flagged ${r.service_name} to cancel — it's still showing as an active subscription.`,
      link: '/statement',
      dedupe_key: `subscription_anomaly:${r.id}`,
    }))
}

/** Categories tracking well above their historical average this month. */
function spendingAnomalyNotifications(
  flagged: { category: string; pctAboveAverage: number }[],
  from = new Date()
): NewNotificationCandidate[] {
  const month = currentMonthKey(from)
  return flagged
    .filter((f) => f.pctAboveAverage >= 25)
    .map((f) => ({
      kind: 'spending_anomaly' as const,
      title: `${f.category} spending is up`,
      body: `Tracking ${Math.round(f.pctAboveAverage)}% above its 3-month average this month.`,
      link: '/stats',
      dedupe_key: `spending_anomaly:${f.category}:${month}`,
    }))
}

/** 25/50/75/100% goal milestones. */
function goalMilestoneNotifications(goals: SavingsGoal[]): NewNotificationCandidate[] {
  const results: NewNotificationCandidate[] = []
  for (const g of goals) {
    if (g.target_amount <= 0) continue
    const pct = (g.current_amount / g.target_amount) * 100
    for (const milestone of [25, 50, 75, 100]) {
      if (pct >= milestone) {
        results.push({
          kind: 'goal_milestone',
          title: milestone === 100 ? `${g.name} is fully funded!` : `${g.name} hit ${milestone}%`,
          body:
            milestone === 100
              ? `You've reached your target of ${g.target_amount} for ${g.name}.`
              : `You're ${milestone}% of the way to your ${g.name} goal.`,
          link: `/goals/${g.id}`,
          dedupe_key: `goal_milestone:${g.id}:${milestone}`,
        })
      }
    }
  }
  return results
}

/** First of the month, current month not yet locked — a nudge to run the close. */
function monthlyCloseReadyNotification(currentSnapshot: MonthlySnapshot | null, from = new Date()): NewNotificationCandidate[] {
  if (from.getDate() > 3) return []
  const month = currentMonthKey(from)
  if (currentSnapshot?.locked_at) return []
  return [
    {
      kind: 'monthly_close_ready',
      title: 'Ready to close last month',
      body: 'Confirm your numbers and lock in last month from the Monthly Close card on your Dashboard.',
      link: '/dashboard',
      dedupe_key: `monthly_close_ready:${month}`,
    },
  ]
}

function briefingReadyNotification(latestBriefingMonth: string | null): NewNotificationCandidate[] {
  if (!latestBriefingMonth) return []
  return [
    {
      kind: 'briefing_ready',
      title: `Your ${monthLabel(latestBriefingMonth)} briefing is ready`,
      body: 'See what happened last month and this month\'s top recommendation.',
      link: '/dashboard',
      dedupe_key: `briefing_ready:${latestBriefingMonth}`,
    },
  ]
}

/** Loot Score moved by a meaningful amount month-on-month. */
function scoreChangeNotification(latest: BudgeScore | null, previous: BudgeScore | null): NewNotificationCandidate[] {
  if (!latest || !previous) return []
  const delta = latest.score - previous.score
  if (Math.abs(delta) < 30) return []
  return [
    {
      kind: 'score_change',
      title: `Your Loot Score ${delta > 0 ? 'improved' : 'dropped'}`,
      body: `${delta > 0 ? '+' : ''}${Math.round(delta)} points vs last month, now ${Math.round(latest.score)}.`,
      link: '/settings',
      dedupe_key: `score_change:${latest.month}`,
    },
  ]
}

export interface NotificationInputs {
  expenses: Expense[]
  taxProfile: TaxProfile | null
  subscriptionReviews: SubscriptionReview[]
  flaggedCategories: { category: string; pctAboveAverage: number }[]
  goals: SavingsGoal[]
  currentSnapshot: MonthlySnapshot | null
  latestBriefingMonth: string | null
  latestScore: BudgeScore | null
  previousScore: BudgeScore | null
}

export function generateNotificationCandidates(inputs: NotificationInputs, from = new Date()): NewNotificationCandidate[] {
  return [
    ...upcomingDebitNotifications(inputs.expenses, from),
    ...taxDeadlineNotifications(inputs.taxProfile, from),
    ...subscriptionNotifications(inputs.subscriptionReviews),
    ...spendingAnomalyNotifications(inputs.flaggedCategories, from),
    ...goalMilestoneNotifications(inputs.goals),
    ...monthlyCloseReadyNotification(inputs.currentSnapshot, from),
    ...briefingReadyNotification(inputs.latestBriefingMonth),
    ...scoreChangeNotification(inputs.latestScore, inputs.previousScore),
  ]
}

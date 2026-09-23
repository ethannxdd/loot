import { getCalendarWithCountdowns } from './tax/calendar'
import { categoryLabel } from './categories'
import { currentMonthKey, daysUntilNextDue, monthLabel, nextDueDate } from './money'
import { formatCurrency } from './utils'
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

/** Upcoming debits — expenses due within their own notify lead time (Business default 7 days on Dashboard). */
function upcomingDebitNotifications(expenses: Expense[], from = new Date()): NewNotificationCandidate[] {
  return expenses
    .filter((e) => !e.deleted_at && e.notify_enabled && e.due_day)
    .map((e) => {
      const days = daysUntilNextDue(e.due_day as number, from)
      if (days > e.notify_lead_days) return null
      const due = nextDueDate(e.due_day as number, from)
      const candidate: NewNotificationCandidate = {
        kind: 'upcoming_debit',
        title: `${e.name} due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
        body: `${e.name} is due on the ${due.getDate()}${ordinalSuffix(due.getDate())}.`,
        link: '/expenses',
        // Keyed by the actual due month so a debit due on the 2nd is notified once per cycle, even if the
        // heads-up arrives on the 30th of the month before.
        dedupe_key: `upcoming_debit:${e.id}:${currentMonthKey(due)}`,
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

/**
 * Tax filing deadlines: a heads-up once a deadline is within 60 days and another once it is within 30.
 * (Matching "exactly 60 / exactly 30 days out" would only fire if the app happened to be opened on that one day.)
 */
function taxDeadlineNotifications(taxProfile: TaxProfile | null, from = new Date()): NewNotificationCandidate[] {
  if (!taxProfile) return []
  // Provisional taxpayers also get the provisional-payment dates; everyone else only the filing deadlines.
  const entries = getCalendarWithCountdowns(from, taxProfile.is_provisional_taxpayer === 'yes')
  const results: NewNotificationCandidate[] = []
  for (const entry of entries) {
    if (entry.daysUntil < 0 || entry.daysUntil > 60) continue
    const mark = entry.daysUntil <= 30 ? 30 : 60
    results.push({
      kind: 'tax_deadline',
      title: `${entry.label} in ${entry.daysUntil} day${entry.daysUntil === 1 ? '' : 's'}`,
      body: entry.description,
      link: '/tax',
      dedupe_key: `tax_deadline:${entry.id}:${mark}`,
    })
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
      title: `${categoryLabel(f.category)} spending is up`,
      body: `Tracking ${Math.round(f.pctAboveAverage)}% above its 3-month average this month.`,
      link: '/stats',
      dedupe_key: `spending_anomaly:${f.category}:${month}`,
    }))
}

/**
 * 25/50/75/100% goal milestones. Only the highest milestone reached is announced — a goal that jumps
 * straight to 100% gets one "fully funded" notification, not four.
 */
function goalMilestoneNotifications(goals: SavingsGoal[]): NewNotificationCandidate[] {
  const results: NewNotificationCandidate[] = []
  for (const g of goals) {
    if (g.target_amount <= 0) continue
    const pct = (g.current_amount / g.target_amount) * 100
    const milestone = [100, 75, 50, 25].find((m) => pct >= m)
    if (!milestone) continue
    results.push({
      kind: 'goal_milestone',
      title: milestone === 100 ? `${g.name} is fully funded!` : `${g.name} hit ${milestone}%`,
      body:
        milestone === 100
          ? `You've reached your target of ${formatCurrency(g.target_amount)} for ${g.name}.`
          : `You're ${milestone}% of the way to your ${g.name} goal.`,
      link: `/goals/${g.id}`,
      dedupe_key: `goal_milestone:${g.id}:${milestone}`,
    })
  }
  return results
}

/** First days of the month, this month not yet locked — a nudge to run the monthly close. */
function monthlyCloseReadyNotification(currentSnapshot: MonthlySnapshot | null, from = new Date()): NewNotificationCandidate[] {
  if (from.getDate() > 3) return []
  const month = currentMonthKey(from)
  if (currentSnapshot?.locked_at) return []
  return [
    {
      kind: 'monthly_close_ready',
      title: 'Time for your monthly close',
      body: `Confirm ${monthLabel(month)}'s numbers and lock them in from the Monthly Close card on your Dashboard.`,
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

/** Loot Score habits index (0–999 internally, shown /100) moved by a meaningful amount month-on-month. */
function scoreChangeNotification(latest: BudgeScore | null, previous: BudgeScore | null): NewNotificationCandidate[] {
  if (!latest || !previous) return []
  const delta = latest.score - previous.score
  if (Math.abs(delta) < 30) return []
  return [
    {
      kind: 'score_change',
      title: `Your money habits ${delta > 0 ? 'improved' : 'slipped'}`,
      body: `${delta > 0 ? '+' : ''}${Math.round(delta / 9.99)} vs last month, now ${Math.round(latest.score / 9.99)}/100 on your Loot Score habits rating.`,
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

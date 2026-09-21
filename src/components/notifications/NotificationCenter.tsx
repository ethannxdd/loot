import { useBudgeScores } from '@/hooks/useBudgeScore'
import { useCurrentMonthSnapshot } from '@/hooks/useMonthlyClose'
import { useMonthlyBriefings } from '@/hooks/useMonthlyBriefing'
import { useExpenses } from '@/hooks/useExpenses'
import { useGenerateNotifications } from '@/hooks/useNotifications'
import { useGoals } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useSubscriptionReviews } from '@/hooks/useSubscriptionReviews'
import { useTaxProfile } from '@/hooks/useTaxProfile'
import { computeForecast } from '@/lib/forecast'

/**
 * Headless — computes and syncs notification candidates from live app state. Mounted
 * once in AppLayout so notifications generate no matter which page the user is on.
 */
export function NotificationCenter() {
  const { data: profile } = useProfile()
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses()
  const { data: taxProfile } = useTaxProfile()
  const { data: subscriptionReviews = [] } = useSubscriptionReviews()
  const { data: goals = [] } = useGoals()
  const { data: snapshots = [] } = useSnapshots(3)
  const { data: currentSnapshot } = useCurrentMonthSnapshot()
  const { data: briefings = [] } = useMonthlyBriefings()
  const { data: scores = [] } = useBudgeScores()

  const forecast = computeForecast(snapshots, expenses, profile?.net_income ?? 0)
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null
  const previousScore = scores.length > 1 ? scores[scores.length - 2] : null

  useGenerateNotifications(
    {
      expenses,
      taxProfile: taxProfile ?? null,
      subscriptionReviews,
      flaggedCategories: forecast.flaggedCategories,
      goals,
      currentSnapshot: currentSnapshot ?? null,
      latestBriefingMonth: briefings[0]?.month ?? null,
      latestScore,
      previousScore,
    },
    Boolean(profile) && !expensesLoading
  )

  return null
}

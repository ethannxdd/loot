import { useMemo } from 'react'
import { buildLootScoreView, type LootScoreView } from '@/lib/loot-score'
import { useBudgeScore } from './useBudgeScore'
import { useBureauScores } from './useBureauScores'
import { useExpenses } from './useExpenses'
import { useProfile } from './useProfile'
import { useSnapshots } from './useSnapshots'

/** The Loot Score as the UI should present it — see lib/loot-score.ts for the three states. */
export function useLootScore(): { view: LootScoreView | null; isLoading: boolean; history: ReturnType<typeof useBudgeScore>['history'] } {
  const { latest, previous, history, isLoading } = useBudgeScore()
  const { data: bureauScores = [], isLoading: bureauLoading } = useBureauScores()
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: snapshots = [] } = useSnapshots(6)

  const view = useMemo(
    () =>
      profile
        ? buildLootScoreView({
            netIncome: profile.net_income,
            expenseCount: expenses.filter((e) => !e.deleted_at).length,
            snapshotMonths: snapshots.length,
            latest,
            previous,
            bureauScores,
          })
        : null,
    [profile, expenses, snapshots.length, latest, previous, bureauScores],
  )

  return { view, isLoading: isLoading || bureauLoading || !profile, history }
}

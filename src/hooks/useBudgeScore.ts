import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { computeBudgeScore } from '@/lib/budge-score'
import { supabase } from '@/lib/supabase'
import type { BudgeScore, Debt, MonthlySnapshot, ScoreFactors } from '@/lib/types'
import { useAuth } from './useAuth'
import { useDebts } from './useDebts'
import { useSnapshots } from './useSnapshots'

export function budgeScoresQueryKey(userId: string | undefined) {
  return ['budge_scores', userId] as const
}

/** Full Loot Score history, oldest first — used for the timeline chart. */
export function useBudgeScores() {
  const { user } = useAuth()
  return useQuery({
    queryKey: budgeScoresQueryKey(user?.id),
    queryFn: async (): Promise<BudgeScore[]> => {
      const { data, error } = await supabase
        .from('budge_scores')
        .select('*')
        .eq('user_id', user!.id)
        .order('month', { ascending: true })
      if (error) throw error
      return (data as BudgeScore[]).map((s) => ({ ...s, factors: s.factors as unknown as ScoreFactors }))
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

function useUpsertBudgeScore() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, score, factors }: { month: string; score: number; factors: ScoreFactors }) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('budge_scores')
        .upsert({ user_id: user.id, month, score, factors }, { onConflict: 'user_id,month' })
        .select()
        .single()
      if (error) throw error
      return data as BudgeScore
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgeScoresQueryKey(user?.id) })
    },
  })
}

export interface BudgeScoreState {
  latest: BudgeScore | null
  history: BudgeScore[]
  previous: BudgeScore | null
  isLoading: boolean
}

/**
 * Reads the Loot Score history and — per Business Rule 12 ("recalculated monthly when
 * snapshot is created or updated") — recomputes and upserts the current month's score
 * whenever the latest monthly snapshot changes underneath it.
 */
export function useBudgeScore(): BudgeScoreState {
  const { data: snapshots = [], isLoading: snapshotsLoading } = useSnapshots(6)
  const { data: debts = [], isLoading: debtsLoading } = useDebts()
  const { data: scores = [], isLoading: scoresLoading } = useBudgeScores()
  const upsert = useUpsertBudgeScore()
  const lastComputedKey = useRef<string | null>(null)

  const latestSnapshot = snapshots[snapshots.length - 1] as MonthlySnapshot | undefined
  const ready = !snapshotsLoading && !debtsLoading && !scoresLoading
  // The score depends on debt figures too (DTI is 30% of it), so recompute when they change as well.
  const debtSignature = debts.map((d) => `${d.id}:${d.balance}:${d.min_payment}`).join('|')

  useEffect(() => {
    // Don't compute until every input has loaded — scoring against a not-yet-fetched (empty) debt list
    // would save a wrong score that then never gets corrected.
    if (!ready || !latestSnapshot) return
    const key = `${latestSnapshot.month}:${latestSnapshot.updated_at}:${debtSignature}`
    if (lastComputedKey.current === key) return
    lastComputedKey.current = key

    const { score, factors } = computeBudgeScore(latestSnapshot, snapshots as MonthlySnapshot[], debts as Debt[])
    const existing = scores.find((s) => s.month === latestSnapshot.month)
    if (existing && existing.score === score) return

    upsert.mutate({ month: latestSnapshot.month, score, factors })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, latestSnapshot?.month, latestSnapshot?.updated_at, debtSignature])

  const history = scores
  const latest = history.length > 0 ? history[history.length - 1] : null
  const previous = history.length > 1 ? history[history.length - 2] : null

  return { latest, history, previous, isLoading: snapshotsLoading || debtsLoading || scoresLoading }
}

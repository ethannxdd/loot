import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BureauScore, NewBureauScore, ScoreFactors } from '@/lib/types'
import { useAuth } from './useAuth'
import { budgeScoresQueryKey } from './useBudgeScore'

export function bureauScoresQueryKey(userId: string | undefined) {
  return ['bureau_scores', userId] as const
}

export function useBureauScores() {
  const { user } = useAuth()
  return useQuery({
    queryKey: bureauScoresQueryKey(user?.id),
    queryFn: async (): Promise<BureauScore[]> => {
      const { data, error } = await supabase
        .from('bureau_scores')
        .select('*')
        .eq('user_id', user!.id)
        .order('reported_on', { ascending: true })
      if (error) throw error
      return data as BureauScore[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

interface AddBureauScoreArgs {
  input: NewBureauScore
  /** The Loot Score estimate at the time of upload, used to compute the calibration gap. */
  estimatedScore: number | null
  factors: ScoreFactors | null
}

/**
 * Records a real bureau score, computes the gap against the current Loot Score estimate,
 * and writes a row to `score_calibration` so this (and future users') estimate can be
 * tuned against real outcomes over time — see LOOT-SCHEMA.md Migration 016.
 */
export function useAddBureauScore() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, estimatedScore, factors }: AddBureauScoreArgs) => {
      if (!user) throw new Error('Not signed in')
      const gap = estimatedScore !== null ? input.score - estimatedScore : null

      const { data, error } = await supabase
        .from('bureau_scores')
        .insert({
          ...input,
          user_id: user.id,
          estimated_score: estimatedScore,
          gap,
          factors: factors ?? {},
        })
        .select()
        .single()
      if (error) throw error

      if (estimatedScore !== null && factors) {
        await supabase.from('score_calibration').insert({
          user_id: user.id,
          bureau: input.bureau,
          real_score: input.score,
          estimated_score: estimatedScore,
          gap: input.score - estimatedScore,
          dti: factors.dti,
          savings_rate: factors.savings_rate,
          payment_consistency: factors.payment_consistency,
          utilisation: factors.utilisation,
          expense_consistency: factors.expense_consistency,
          reported_on: input.reported_on,
        })
      }

      return data as BureauScore
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bureauScoresQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: budgeScoresQueryKey(user?.id) })
    },
  })
}

export function useDeleteBureauScore() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bureau_scores').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bureauScoresQueryKey(user?.id) })
    },
  })
}

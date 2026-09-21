import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BankId, StatementAnalysis } from '@/lib/types'
import { useAuth } from './useAuth'

export function statementAnalysesQueryKey(userId: string | undefined) {
  return ['statement_analyses', userId] as const
}

export function useStatementAnalyses(limit = 12) {
  const { user } = useAuth()
  return useQuery({
    queryKey: statementAnalysesQueryKey(user?.id),
    queryFn: async (): Promise<StatementAnalysis[]> => {
      const { data, error } = await supabase
        .from('statement_analyses')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as StatementAnalysis[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useSaveStatementAnalysis() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      bank: BankId
      statementMonth: string | null
      totalIncome: number
      totalSpent: number
      categoryTotals: Record<string, number>
      subscriptionItems: { service_name: string; amount: number; last_charged: string }[]
    }) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('statement_analyses')
        .insert({
          user_id: user.id,
          bank: input.bank,
          statement_month: input.statementMonth,
          total_income: input.totalIncome,
          total_spent: input.totalSpent,
          category_totals: input.categoryTotals,
          subscription_items: input.subscriptionItems,
        })
        .select()
        .single()
      if (error) throw error
      return data as StatementAnalysis
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statementAnalysesQueryKey(user?.id) }),
  })
}

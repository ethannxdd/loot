import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TfsaContribution } from '@/lib/future'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useFeature } from './useFeatures'

/** Phase 6 B6 data: TFSA contributions and the retirement profile (Migration 031). */

export interface RetirementProfile {
  user_id: string
  retirement_age: number
  current_age: number | null
  ra_balance: number
  pension_balance: number
  savings_pot_balance: number
  monthly_contribution: number
  employer_contribution: number
  real_return_pct: number | null
  desired_income: number | null
}

export function useTfsaContributions() {
  const { user } = useAuth()
  const on = useFeature('future_you')
  return useQuery({
    queryKey: ['tfsa_contributions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tfsa_contributions').select('*').eq('user_id', user!.id).order('contributed_on', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as TfsaContribution[]
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

export function useAddTfsaContribution() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Pick<TfsaContribution, 'tax_year' | 'amount' | 'contributed_on' | 'provider'>) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase.from('tfsa_contributions').insert({ ...c, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tfsa_contributions', user?.id] }),
  })
}

export function useDeleteTfsaContribution() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tfsa_contributions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tfsa_contributions', user?.id] }),
  })
}

export function useRetirementProfile() {
  const { user } = useAuth()
  const on = useFeature('future_you')
  return useQuery({
    queryKey: ['retirement_profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('retirement_profile').select('*').eq('user_id', user!.id).maybeSingle()
      if (error) throw error
      if (!data) return null
      const n = (v: unknown) => (v == null ? null : Number(v))
      return {
        ...data,
        ra_balance: Number(data.ra_balance),
        pension_balance: Number(data.pension_balance),
        savings_pot_balance: Number(data.savings_pot_balance ?? 0),
        monthly_contribution: Number(data.monthly_contribution),
        employer_contribution: Number(data.employer_contribution),
        real_return_pct: n(data.real_return_pct),
        desired_income: n(data.desired_income),
      } as RetirementProfile
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 60_000,
  })
}

export function useSaveRetirementProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<RetirementProfile, 'user_id'>>) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase.from('retirement_profile').upsert({ ...patch, user_id: user.id }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['retirement_profile', user?.id] }),
  })
}

/** "Ask Loot today: 3 of 30" (Settings → Your data). */
export function useAssistantUsage() {
  const { user } = useAuth()
  const on = useFeature('assistant')
  return useQuery({
    queryKey: ['assistant_usage', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_assistant_usage')
      if (error) throw error
      return data as { used: number; cap: number }
    },
    enabled: Boolean(user?.id) && on,
    retry: false,
    meta: { silent: true },
  })
}

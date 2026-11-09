import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Challenge, Checkin } from '@/lib/challenges'
import type { PriceEvent, Renewal } from '@/lib/stay-ahead'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useFeature } from './useFeatures'

/** Phase 6 B5 data: renewals, published price events, challenges + check-ins (Migration 030). */

export function useRenewals() {
  const { user } = useAuth()
  const on = useFeature('renewals')
  return useQuery({
    queryKey: ['renewals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('renewals').select('*').eq('user_id', user!.id).order('renews_on')
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount) })) as Renewal[]
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

/** Published price events only (RLS hides drafts). */
export function usePriceEvents() {
  const { user } = useAuth()
  const on = useFeature('renewals')
  return useQuery({
    queryKey: ['price_events', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('price_events').select('*').eq('status', 'published').order('effective_on')
      if (error) throw error
      return (data ?? []).map((e) => ({
        ...e,
        change_pct: e.change_pct == null ? null : Number(e.change_pct),
        change_amount: e.change_amount == null ? null : Number(e.change_amount),
      })) as PriceEvent[]
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 60 * 60_000,
  })
}

export function useSaveRenewal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Omit<Renewal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'ended_at'> }) => {
      if (!user) throw new Error('Not signed in')
      const { error } = id ? await supabase.from('renewals').update(values).eq('id', id) : await supabase.from('renewals').insert({ ...values, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['renewals', user?.id] }),
  })
}

export function useDeleteRenewal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('renewals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['renewals', user?.id] }),
  })
}

export function useChallenges() {
  const { user } = useAuth()
  const on = useFeature('challenges')
  return useQuery({
    queryKey: ['challenges', user?.id],
    queryFn: async () => {
      const [c, k] = await Promise.all([
        supabase.from('challenges').select('*').eq('user_id', user!.id).order('starts_on', { ascending: false }),
        supabase.from('challenge_checkins').select('*').eq('user_id', user!.id),
      ])
      if (c.error) throw c.error
      if (k.error) throw k.error
      return {
        challenges: (c.data ?? []) as Challenge[],
        checkins: (k.data ?? []).map((x) => ({ ...x, amount_saved: Number(x.amount_saved) })) as Checkin[],
      }
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

export function useCreateChallenge() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Pick<Challenge, 'kind' | 'title' | 'starts_on' | 'ends_on' | 'settings' | 'goal_id'>) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase.from('challenges').insert({ ...c, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['challenges', user?.id] }),
  })
}

export function useUpdateChallenge() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Challenge> }) => {
      const { error } = await supabase.from('challenges').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['challenges', user?.id] }),
  })
}

/** Writes check-ins (manual or the auto-checks computed on open). Existing days are left alone. */
export function useCheckIn() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: { challenge_id: string; day: string; success: boolean; amount_saved?: number; auto?: boolean }[]) => {
      if (!user || rows.length === 0) return
      const { error } = await supabase
        .from('challenge_checkins')
        .upsert(
          rows.map((r) => ({ amount_saved: 0, auto: false, ...r, user_id: user.id })),
          { onConflict: 'challenge_id,day', ignoreDuplicates: true },
        )
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['challenges', user?.id] }),
  })
}

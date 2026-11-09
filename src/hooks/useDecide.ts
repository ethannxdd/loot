import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AffordabilityResult } from '@/lib/money'
import { readyAt, snoozeUntil, type CoolOffDays, type WishlistItem } from '@/lib/wishlist'
import { useAuth } from './useAuth'
import { useFeature } from './useFeatures'
import { spendEntriesQueryKey } from './useSpendEntries'

/** Phase 6 B4 data: wishlist items and saved tool scenarios (Migration 029). */

export function useWishlist() {
  const { user } = useAuth()
  const on = useFeature('wishlist')
  return useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('wishlist_items').select('*').eq('user_id', user!.id).order('added_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, price: Number(r.price), target_price: r.target_price == null ? null : Number(r.target_price) })) as WishlistItem[]
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

export interface NewWishlistItem {
  name: string
  price: number
  url: string | null
  category: string | null
  cool_off_days: CoolOffDays
  tags: string[]
  target_price: number | null
}

export function useAddWishlistItem() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: NewWishlistItem) => {
      if (!user) throw new Error('Not signed in')
      const now = new Date()
      const { error } = await supabase.from('wishlist_items').insert({
        ...item,
        user_id: user.id,
        added_at: now.toISOString(),
        ready_at: readyAt(now, item.cool_off_days).toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wishlist', user?.id] }),
  })
}

export function useUpdateWishlistItem() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<WishlistItem> }) => {
      const { error } = await supabase.from('wishlist_items').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wishlist', user?.id] }),
  })
}

/** Ready-time decision: buy (optionally logging the spend), not yet (snooze 7 days) or drop. */
export function useDecideWishlist() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      item,
      action,
      verdict,
      logSpend,
    }: {
      item: WishlistItem
      action: 'buy' | 'snooze' | 'drop' | 'buy_now'
      verdict?: AffordabilityResult | null
      logSpend?: boolean
    }) => {
      if (!user) throw new Error('Not signed in')
      const now = new Date()
      const patch: Partial<WishlistItem> =
        action === 'snooze'
          ? { status: 'snoozed', snoozed_until: snoozeUntil(now).toISOString() }
          : { status: action === 'drop' ? 'dropped' : 'bought', decided_at: now.toISOString() }
      if (verdict) {
        patch.verdict = verdict.verdict
        patch.verdict_reasoning = verdict.reasoning.slice(0, 1000)
      }
      const { error } = await supabase.from('wishlist_items').update(patch).eq('id', item.id)
      if (error) throw error
      if ((action === 'buy' || action === 'buy_now') && logSpend) {
        const { error: e2 } = await supabase.from('spend_entries').insert({
          user_id: user.id,
          amount: item.target_price ?? item.price,
          merchant: item.name,
          category: item.category ?? 'other',
          source: 'manual',
        })
        if (e2) throw e2
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wishlist', user?.id] })
      void qc.invalidateQueries({ queryKey: spendEntriesQueryKey(user?.id) })
    },
  })
}

export function useDeleteWishlistItem() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wishlist_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wishlist', user?.id] }),
  })
}

// ---------------------------------------------------------------------------------------------------------
// Saved scenarios (inputs only)
// ---------------------------------------------------------------------------------------------------------

export type ToolKey = 'car' | 'rent_vs_buy' | 'moving_out' | 'runway' | 'january' | 'black_friday' | 'two_pot' | 'retirement'

export interface SavedScenario<T = Record<string, unknown>> {
  id: string
  user_id: string
  tool: ToolKey
  name: string
  inputs: T
  created_at: string
  updated_at: string
}

export function useScenarios(tool?: ToolKey) {
  const { user } = useAuth()
  const tools = useFeature('tools')
  const future = useFeature('future_you')
  return useQuery({
    queryKey: ['saved_scenarios', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('saved_scenarios').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false })
      if (error) throw error
      return data as SavedScenario[]
    },
    enabled: Boolean(user?.id) && (tools || future),
    staleTime: 30_000,
    select: (rows) => (tool ? rows.filter((r) => r.tool === tool) : rows),
  })
}

export function useSaveScenario() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tool, name, inputs }: { id?: string; tool: ToolKey; name: string; inputs: object }) => {
      if (!user) throw new Error('Not signed in')
      const row = { tool, name: name.trim().slice(0, 80) || 'Untitled', inputs }
      const { error } = id
        ? await supabase.from('saved_scenarios').update(row).eq('id', id)
        : await supabase.from('saved_scenarios').insert({ ...row, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['saved_scenarios', user?.id] }),
  })
}

export function useDeleteScenario() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_scenarios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['saved_scenarios', user?.id] }),
  })
}

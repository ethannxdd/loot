import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { disposableIncome, safetyBufferAmount } from '@/lib/money'
import {
  budgetsFor,
  merchantKey,
  safeToSpend,
  type MerchantRule,
  type NewSpendEntry,
  type SpendEntry,
} from '@/lib/spending'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useLiveCycle } from './useCycle'
import { useExpenses } from './useExpenses'
import { useFeature } from './useFeatures'
import { useProfile } from './useProfile'

/** How far back the spend log is loaded — enough for the current cycle plus two before it (monthly close review). */
const HISTORY_DAYS = 110

export function spendEntriesQueryKey(userId: string | undefined) {
  return ['spend_entries', userId] as const
}

export function merchantRulesQueryKey(userId: string | undefined) {
  return ['spend_merchant_rules', userId] as const
}

/** The signed-in person's spend log (Migration 026). Only runs with `live_cycle` on, so a missing table never errors. */
export function useSpendEntries() {
  const { user } = useAuth()
  const live = useFeature('live_cycle')
  return useQuery({
    queryKey: spendEntriesQueryKey(user?.id),
    queryFn: async (): Promise<SpendEntry[]> => {
      const since = new Date()
      since.setDate(since.getDate() - HISTORY_DAYS)
      const { data, error } = await supabase
        .from('spend_entries')
        .select('*')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .gte('spent_at', since.toISOString())
        .order('spent_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return (data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as SpendEntry[]
    },
    enabled: Boolean(user?.id) && live,
    staleTime: 15_000,
  })
}

export function useMerchantRules() {
  const { user } = useAuth()
  const live = useFeature('live_cycle')
  return useQuery({
    queryKey: merchantRulesQueryKey(user?.id),
    queryFn: async (): Promise<MerchantRule[]> => {
      const { data, error } = await supabase.from('spend_merchant_rules').select('*').eq('user_id', user!.id)
      if (error) throw error
      return data as MerchantRule[]
    },
    enabled: Boolean(user?.id) && live,
    staleTime: 60_000,
  })
}

async function rememberMerchant(userId: string, merchant: string | null | undefined, category: string | null | undefined) {
  const key = merchantKey(merchant)
  if (!key || !category) return
  const { error } = await supabase
    .from('spend_merchant_rules')
    .upsert({ user_id: userId, merchant_key: key, category, updated_at: new Date().toISOString() }, { onConflict: 'user_id,merchant_key' })
  if (error) console.warn('Merchant rule not saved', error)
}

/** Logs a spend. Optimistic: the hero, Budgets and /spending update before the server answers. */
export function useLogSpend() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = spendEntriesQueryKey(user?.id)
  return useMutation({
    mutationFn: async (entry: NewSpendEntry) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('spend_entries')
        .insert({ source: 'manual', ...entry, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      await rememberMerchant(user.id, entry.merchant, entry.category)
      return { ...data, amount: Number(data.amount) } as SpendEntry
    },
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SpendEntry[]>(key)
      const now = new Date().toISOString()
      const temp: SpendEntry = {
        id: `temp-${Math.random().toString(36).slice(2)}`,
        user_id: user?.id ?? '',
        amount: entry.amount,
        merchant: entry.merchant ?? null,
        note: entry.note ?? null,
        category: entry.category,
        spent_at: entry.spent_at ?? now,
        source: entry.source ?? 'manual',
        source_id: entry.source_id ?? null,
        external_hash: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      }
      queryClient.setQueryData<SpendEntry[]>(key, (old = []) => [temp, ...old])
      return { previous, tempId: temp.id }
    },
    onError: (_err, _entry, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.previous)
    },
    onSuccess: (saved, _entry, ctx) => {
      queryClient.setQueryData<SpendEntry[]>(key, (old = []) => old.map((e) => (e.id === ctx?.tempId ? saved : e)))
      void queryClient.invalidateQueries({ queryKey: merchantRulesQueryKey(user?.id) })
    },
  })
}

/** Edits an entry (amount, merchant, category, date). Changing the category also updates the merchant memory. */
export function useUpdateSpend() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = spendEntriesQueryKey(user?.id)
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SpendEntry> }) => {
      const { data, error } = await supabase.from('spend_entries').update(patch).eq('id', id).select().single()
      if (error) throw error
      if (user && patch.category) await rememberMerchant(user.id, data.merchant, patch.category)
      return { ...data, amount: Number(data.amount) } as SpendEntry
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SpendEntry[]>(key)
      queryClient.setQueryData<SpendEntry[]>(key, (old = []) => old.map((e) => (e.id === id ? { ...e, ...patch } : e)))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: merchantRulesQueryKey(user?.id) })
    },
  })
}

/**
 * Removes an entry from the log. `soft` (default) sets deleted_at so Undo can bring it back; the immediate Undo of a
 * just-logged spend deletes the row outright.
 */
export function useDeleteSpend() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = spendEntriesQueryKey(user?.id)
  return useMutation({
    mutationFn: async ({ id, soft = true }: { id: string; soft?: boolean }) => {
      const { error } = soft
        ? await supabase.from('spend_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id)
        : await supabase.from('spend_entries').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SpendEntry[]>(key)
      queryClient.setQueryData<SpendEntry[]>(key, (old = []) => old.filter((e) => e.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.previous)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Brings back a soft-deleted entry (Undo after delete). */
export function useRestoreSpend() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spend_entries').update({ deleted_at: null }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: spendEntriesQueryKey(user?.id) }),
  })
}

/**
 * Safe to spend for the current cycle (Rule 19), from the person's own numbers — household view never uses spend
 * entries (D9). `cycle` can be passed to look at a past cycle on /spending.
 */
export function useSafeToSpend(cycleOverride?: ReturnType<typeof useLiveCycle>['cycle']) {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: entries = [], isLoading } = useSpendEntries()
  const { cycle: current, live, settings } = useLiveCycle()
  const cycle = cycleOverride ?? current

  return useMemo(() => {
    const netIncome = profile?.net_income ?? 0
    const disposable = disposableIncome(netIncome, expenses)
    const buffer = safetyBufferAmount(netIncome, profile?.safety_buffer_pct ?? 0)
    const budgets = budgetsFor(expenses)
    const result = safeToSpend({ disposable, buffer, budgets, entries, cycle })
    return { ...result, budgets, buffer, disposable, cycle, entries, live, settings, isLoading }
  }, [profile?.net_income, profile?.safety_buffer_pct, expenses, entries, cycle, live, settings, isLoading])
}

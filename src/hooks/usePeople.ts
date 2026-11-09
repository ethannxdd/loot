import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Split, SplitShare } from '@/lib/splits'
import type { NewSpendEntry } from '@/lib/spending'
import {
  monthlyContribution,
  payoutFor,
  STOKVEL_EXPENSE_CATEGORY,
  type OnceOffIncome,
  type Stokvel,
  type StokvelMember,
  type StokvelPayment,
} from '@/lib/stokvel'
import { useAuth } from './useAuth'
import { refreshCurrentSnapshot } from './useExpenses'
import { useFeature } from './useFeatures'
import { goalsQueryKey } from './useGoals'
import { spendEntriesQueryKey } from './useSpendEntries'

/** Phase 6 B3 data: stokvels, splits and once-off income (Migration 028). Queries only run with their flag on. */

const num = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row }
  for (const k of keys) if (out[k] != null) (out as Record<string, unknown>)[k as string] = Number(out[k])
  return out
}

// ---------------------------------------------------------------------------------------------------------
// Stokvels
// ---------------------------------------------------------------------------------------------------------

export function useStokvels() {
  const { user } = useAuth()
  const on = useFeature('stokvels')
  return useQuery({
    queryKey: ['stokvels', user?.id],
    queryFn: async () => {
      const [s, m, p] = await Promise.all([
        supabase.from('stokvels').select('*').eq('user_id', user!.id).order('created_at'),
        supabase.from('stokvel_members').select('*').eq('user_id', user!.id).order('position'),
        supabase.from('stokvel_payments').select('*').eq('user_id', user!.id).order('month'),
      ])
      if (s.error) throw s.error
      if (m.error) throw m.error
      if (p.error) throw p.error
      return {
        stokvels: (s.data ?? []).map((r) => num(r, ['contribution_amount', 'expected_interest_pct'])) as Stokvel[],
        members: (m.data ?? []) as StokvelMember[],
        payments: (p.data ?? []).map((r) => num(r, ['amount'])) as StokvelPayment[],
      }
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

export function useOnceOffIncome() {
  const { user } = useAuth()
  const on = useFeature('stokvels')
  return useQuery({
    queryKey: ['once_off_income', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('once_off_income').select('*').eq('user_id', user!.id).order('expected_on')
      if (error) throw error
      return (data ?? []).map((r) => num(r, ['amount'])) as OnceOffIncome[]
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

export interface NewStokvelInput {
  stokvel: Omit<Stokvel, 'id' | 'user_id' | 'expense_id' | 'ended_at' | 'created_at' | 'updated_at'>
  /** Member names in order (rotating), "you" included as `me`. */
  members: { name: string; is_me: boolean }[]
  /** Create the linked monthly commitment (default on). */
  linkExpense: boolean
}

function invalidatePeople(qc: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  void qc.invalidateQueries({ queryKey: ['stokvels', userId] })
  void qc.invalidateQueries({ queryKey: ['once_off_income', userId] })
}

/** Creates a stokvel with its members, the linked fixed expense and the payout as planned once-off income. */
export function useCreateStokvel() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ stokvel, members, linkExpense }: NewStokvelInput) => {
      if (!user) throw new Error('Not signed in')
      const { data: created, error } = await supabase.from('stokvels').insert({ ...stokvel, user_id: user.id }).select().single()
      if (error) throw error
      const s = num(created, ['contribution_amount', 'expected_interest_pct']) as Stokvel
      if (members.length > 0) {
        const { error: mErr } = await supabase
          .from('stokvel_members')
          .insert(members.map((m, i) => ({ stokvel_id: s.id, user_id: user.id, name: m.name, is_me: m.is_me, position: i + 1 })))
        if (mErr) throw mErr
      }
      await syncLinked(user.id, s, linkExpense)
      return s
    },
    onSuccess: async () => {
      invalidatePeople(qc, user?.id)
      if (user) await refreshCurrentSnapshot(qc, user.id).catch(() => undefined)
    },
  })
}

/** Keeps the linked expense and the payout's once-off income in step with the stokvel. */
async function syncLinked(userId: string, s: Stokvel, linkExpense: boolean) {
  const amount = Math.round(monthlyContribution(s) * 100) / 100
  if (linkExpense) {
    const expense = {
      name: `${s.name} stokvel`,
      category: STOKVEL_EXPENSE_CATEGORY[s.type],
      amount,
      frequency: 'monthly',
      is_fixed: true,
      due_day: s.contribution_day,
    }
    if (s.expense_id) {
      await supabase.from('expenses').update({ amount: expense.amount, name: expense.name, due_day: expense.due_day }).eq('id', s.expense_id)
    } else {
      const { data } = await supabase.from('expenses').insert({ ...expense, user_id: userId }).select('id').single()
      if (data) await supabase.from('stokvels').update({ expense_id: data.id }).eq('id', s.id)
    }
  }
  const payout = payoutFor(s)
  const { data: existing } = await supabase.from('once_off_income').select('id, received_on').eq('source_id', s.id).eq('kind', 'stokvel')
  const open = (existing ?? []).find((r) => !r.received_on)
  if (!payout) {
    if (open) await supabase.from('once_off_income').delete().eq('id', open.id)
    return
  }
  const row = {
    label: `${s.name} payout`,
    amount: payout.amount,
    expected_on: payout.date ?? payout.month,
    kind: 'stokvel',
    source_id: s.id,
  }
  if (open) await supabase.from('once_off_income').update(row).eq('id', open.id)
  else if (!(existing ?? []).length) await supabase.from('once_off_income').insert({ ...row, user_id: userId })
}

export function useUpdateStokvel() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Stokvel> }) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase.from('stokvels').update(patch).eq('id', id).select().single()
      if (error) throw error
      const s = num(data, ['contribution_amount', 'expected_interest_pct']) as Stokvel
      await syncLinked(user.id, s, Boolean(s.expense_id))
      return s
    },
    onSuccess: async () => {
      invalidatePeople(qc, user?.id)
      if (user) await refreshCurrentSnapshot(qc, user.id).catch(() => undefined)
    },
  })
}

/** Deletes a stokvel, its linked expense (soft-deleted, so it can be restored on Expenses) and its planned payout. */
export function useDeleteStokvel() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: Stokvel) => {
      if (s.expense_id) await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', s.expense_id)
      await supabase.from('once_off_income').delete().eq('source_id', s.id).is('received_on', null)
      const { error } = await supabase.from('stokvels').delete().eq('id', s.id)
      if (error) throw error
    },
    onSuccess: async () => {
      invalidatePeople(qc, user?.id)
      if (user) await refreshCurrentSnapshot(qc, user.id).catch(() => undefined)
    },
  })
}

/** Ticks a contribution month off (or un-ticks it). */
export function useToggleStokvelPayment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ stokvel, month, paid }: { stokvel: Stokvel; month: string; paid: boolean }) => {
      if (!user) throw new Error('Not signed in')
      if (paid) {
        const { error } = await supabase
          .from('stokvel_payments')
          .upsert(
            { stokvel_id: stokvel.id, user_id: user.id, month, kind: 'contribution', amount: Math.round(monthlyContribution(stokvel) * 100) / 100 },
            { onConflict: 'stokvel_id,month,kind' },
          )
        if (error) throw error
      } else {
        const { error } = await supabase.from('stokvel_payments').delete().eq('stokvel_id', stokvel.id).eq('month', month).eq('kind', 'contribution')
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stokvels', user?.id] }),
  })
}

/** Payout received → "Add to this cycle" (a money-back spend entry) or "Put into a goal" (a goal contribution). */
export function useReceiveIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ income, as, goalId }: { income: OnceOffIncome; as: 'cycle' | 'goal'; goalId?: string }) => {
      if (!user) throw new Error('Not signed in')
      const today = new Date()
      const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      if (as === 'cycle') {
        const entry: NewSpendEntry & { user_id: string } = {
          user_id: user.id,
          amount: -Number(income.amount),
          merchant: income.label,
          category: 'savings',
          source: 'stokvel',
          source_id: income.id,
        }
        const { error } = await supabase.from('spend_entries').insert(entry)
        if (error) throw error
      } else {
        if (!goalId) throw new Error('Choose a goal.')
        const { data: goal, error: gErr } = await supabase.from('savings_goals').select('current_amount').eq('id', goalId).single()
        if (gErr) throw gErr
        const { error } = await supabase.from('goal_contributions').insert({ goal_id: goalId, user_id: user.id, amount: income.amount, note: income.label })
        if (error) throw error
        await supabase.from('savings_goals').update({ current_amount: Number(goal.current_amount) + Number(income.amount) }).eq('id', goalId)
      }
      const { error } = await supabase
        .from('once_off_income')
        .update({ received_on: day, handled_as: as, goal_id: as === 'goal' ? goalId : null })
        .eq('id', income.id)
      if (error) throw error
      if (income.kind === 'stokvel' && income.source_id) {
        await supabase.from('stokvel_payments').upsert(
          { stokvel_id: income.source_id, user_id: user.id, month: `${day.slice(0, 7)}-01`, kind: 'payout', amount: income.amount },
          { onConflict: 'stokvel_id,month,kind' },
        )
      }
    },
    onSuccess: () => {
      invalidatePeople(qc, user?.id)
      void qc.invalidateQueries({ queryKey: spendEntriesQueryKey(user?.id) })
      void qc.invalidateQueries({ queryKey: goalsQueryKey(user?.id) })
    },
  })
}

// ---------------------------------------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------------------------------------

export function useSplits() {
  const { user } = useAuth()
  const on = useFeature('splits')
  return useQuery({
    queryKey: ['splits', user?.id],
    queryFn: async () => {
      const [s, sh] = await Promise.all([
        supabase.from('splits').select('*').eq('user_id', user!.id).is('deleted_at', null).order('spent_on', { ascending: false }),
        supabase.from('split_shares').select('*').eq('user_id', user!.id),
      ])
      if (s.error) throw s.error
      if (sh.error) throw sh.error
      return {
        splits: (s.data ?? []).map((r) => num(r, ['total'])) as Split[],
        shares: (sh.data ?? []).map((r) => num(r, ['amount', 'settled_amount'])) as SplitShare[],
      }
    },
    enabled: Boolean(user?.id) && on,
    staleTime: 30_000,
  })
}

export interface NewSplitInput {
  split: Pick<Split, 'title' | 'total' | 'spent_on' | 'paid_by' | 'payer_name' | 'split_mode' | 'note'>
  shares: { person_name: string; is_me: boolean; amount: number }[]
  /** I paid: log the full amount as a spend now (category). */
  logSpend: { category: string } | null
}

export function useCreateSplit() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ split, shares, logSpend }: NewSplitInput) => {
      if (!user) throw new Error('Not signed in')
      let spendEntryId: string | null = null
      if (logSpend && split.paid_by === 'me') {
        const { data, error } = await supabase
          .from('spend_entries')
          .insert({
            user_id: user.id,
            amount: split.total,
            merchant: split.title,
            category: logSpend.category,
            source: 'split',
            spent_at: new Date(`${split.spent_on}T12:00:00`).toISOString(),
          })
          .select('id')
          .single()
        if (error) throw error
        spendEntryId = data.id
      }
      const { data: created, error } = await supabase
        .from('splits')
        .insert({ ...split, user_id: user.id, spend_entry_id: spendEntryId })
        .select()
        .single()
      if (error) throw error
      const { error: shErr } = await supabase
        .from('split_shares')
        // My own share of a bill I paid is settled from the start — there's nobody to pay back.
        .insert(
          shares.map((s) => ({
            ...s,
            split_id: created.id,
            user_id: user.id,
            settled_amount: s.is_me && split.paid_by === 'me' ? s.amount : 0,
            settled_at: s.is_me && split.paid_by === 'me' ? new Date().toISOString() : null,
          })),
        )
      if (shErr) throw shErr
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['splits', user?.id] })
      void qc.invalidateQueries({ queryKey: spendEntriesQueryKey(user?.id) })
    },
  })
}

/**
 * Settles part or all of a share. Money owed to me coming back is a money-back spend entry (so the cycle nets to my
 * share); settling what I owe can log my share as a spend. The original spend entry is never deleted.
 */
export function useSettleShare() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      split,
      share,
      settled_amount,
      settled_at,
      applied,
      category,
    }: {
      split: Split
      share: SplitShare
      settled_amount: number
      settled_at: string | null
      applied: number
      category: string | null
    }) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase.from('split_shares').update({ settled_amount, settled_at }).eq('id', share.id)
      if (error) throw error
      if (applied > 0 && category) {
        const amount = split.paid_by === 'me' ? -applied : applied
        const { error: eErr } = await supabase.from('spend_entries').insert({
          user_id: user.id,
          amount,
          merchant: `${split.title} · ${split.paid_by === 'me' ? share.person_name : split.payer_name ?? 'split'}`,
          category,
          source: 'split',
          source_id: share.id,
        })
        if (eErr) throw eErr
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['splits', user?.id] })
      void qc.invalidateQueries({ queryKey: spendEntriesQueryKey(user?.id) })
    },
  })
}

export function useDeleteSplit() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('splits').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['splits', user?.id] }),
  })
}

export function useRestoreSplit() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('splits').update({ deleted_at: null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['splits', user?.id] }),
  })
}

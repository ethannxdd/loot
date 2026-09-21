import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchProfile, profileQueryKey } from '@/lib/profile'
import { upsertCurrentMonthSnapshot } from '@/lib/snapshot'
import { supabase } from '@/lib/supabase'
import type { Expense, NewExpense } from '@/lib/types'
import { useAuth } from './useAuth'

export function expensesQueryKey(userId: string | undefined) {
  return ['expenses', userId] as const
}

export async function fetchExpenses(userId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Expense[]
}

export function useExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: expensesQueryKey(user?.id),
    queryFn: () => fetchExpenses(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/**
 * Business Rule 9: re-derives the current month's snapshot from live income + expenses (never touching a
 * locked one) and refreshes everything that reads snapshots. Call after ANY change to income or expenses.
 */
export async function refreshCurrentSnapshot(queryClient: QueryClient, userId: string) {
  const [profile, expenses] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: profileQueryKey(userId),
      queryFn: () => fetchProfile(userId),
      staleTime: 0,
    }),
    queryClient.fetchQuery({
      queryKey: expensesQueryKey(userId),
      queryFn: () => fetchExpenses(userId),
      staleTime: 0,
    }),
  ])
  await upsertCurrentMonthSnapshot(profile, expenses)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['monthly_snapshots', userId] }),
    queryClient.invalidateQueries({ queryKey: ['monthly_snapshot', userId] }),
    queryClient.invalidateQueries({ queryKey: ['budge_scores', userId] }),
  ])
}

function useExpensesMutation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return {
    user,
    queryClient,
    async invalidateAndSync() {
      if (!user) return
      // refreshCurrentSnapshot re-fetches expenses itself, so the list and the snapshot always agree.
      // The expense change itself has already succeeded, so a snapshot hiccup must not turn it into a
      // failed mutation (which would leave the form open and the user re-submitting a duplicate).
      try {
        await refreshCurrentSnapshot(queryClient, user.id)
      } catch (err) {
        console.warn('Snapshot refresh failed', err)
        await queryClient.invalidateQueries({ queryKey: expensesQueryKey(user.id) })
        toast.warning("Saved, but your monthly snapshot couldn't refresh. It will catch up next time.")
      }
    },
  }
}

export function useAddExpense() {
  const { user, invalidateAndSync } = useExpensesMutation()
  return useMutation({
    mutationFn: async (expense: NewExpense) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expense, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Expense
    },
    onSuccess: invalidateAndSync,
  })
}

export function useUpdateExpense() {
  const { invalidateAndSync } = useExpensesMutation()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Expense> }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Expense
    },
    onSuccess: invalidateAndSync,
  })
}

export function useSoftDeleteExpense() {
  const { invalidateAndSync } = useExpensesMutation()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateAndSync,
  })
}

export function useRestoreExpense() {
  const { invalidateAndSync } = useExpensesMutation()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').update({ deleted_at: null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateAndSync,
  })
}

export function useDeleteExpensePermanently() {
  const { invalidateAndSync } = useExpensesMutation()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateAndSync,
  })
}

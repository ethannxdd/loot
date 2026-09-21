import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchProfile, profileQueryKey } from '@/lib/profile'
import { upsertCurrentMonthSnapshot } from '@/lib/snapshot'
import { supabase } from '@/lib/supabase'
import type { Expense, NewExpense } from '@/lib/types'
import { useAuth } from './useAuth'

export function expensesQueryKey(userId: string | undefined) {
  return ['expenses', userId] as const
}

export function useExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: expensesQueryKey(user?.id),
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Expense[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/** Re-derives the current month's snapshot after any expense or income change. */
async function syncSnapshot(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  const [profile, expenses] = await Promise.all([
    queryClient.ensureQueryData({
      queryKey: profileQueryKey(userId),
      queryFn: () => fetchProfile(userId),
    }),
    queryClient.fetchQuery({
      queryKey: expensesQueryKey(userId),
      queryFn: async () => {
        const { data, error } = await supabase.from('expenses').select('*').eq('user_id', userId)
        if (error) throw error
        return data as Expense[]
      },
    }),
  ])
  await upsertCurrentMonthSnapshot(profile, expenses)
  queryClient.invalidateQueries({ queryKey: ['monthly_snapshots', userId] })
}

function useExpensesMutation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return {
    user,
    queryClient,
    async invalidateAndSync() {
      if (!user) return
      await queryClient.invalidateQueries({ queryKey: expensesQueryKey(user.id) })
      await syncSnapshot(queryClient, user.id)
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

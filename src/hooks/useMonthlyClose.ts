import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentMonthKey } from '@/lib/money'
import { upsertCurrentMonthSnapshot } from '@/lib/snapshot'
import { supabase } from '@/lib/supabase'
import type { Expense, MonthlySnapshot, Profile } from '@/lib/types'
import { useAuth } from './useAuth'
import { snapshotsQueryKey } from './useSnapshots'

/** The current month's snapshot row (locked or not) — used to know whether this month has been closed. */
export function useCurrentMonthSnapshot() {
  const { user } = useAuth()
  const month = currentMonthKey()
  return useQuery({
    queryKey: ['monthly_snapshot', user?.id, month],
    queryFn: async (): Promise<MonthlySnapshot | null> => {
      const { data, error } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('user_id', user!.id)
        .eq('month', month)
        .maybeSingle()
      if (error) throw error
      return data as MonthlySnapshot | null
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/**
 * Locks the current month: makes sure the snapshot reflects the latest live data, then
 * sets `locked_at` + `close_notes`. Per Business Rule 9, a locked snapshot is never
 * overwritten by the live auto-update again.
 */
export function useLockCurrentMonth() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const month = currentMonthKey()
  return useMutation({
    mutationFn: async ({ profile, expenses, notes }: { profile: Profile; expenses: Expense[]; notes: string }) => {
      if (!user) throw new Error('Not signed in')
      await upsertCurrentMonthSnapshot(profile, expenses)
      const { data, error } = await supabase
        .from('monthly_snapshots')
        .update({ locked_at: new Date().toISOString(), close_notes: notes || null })
        .eq('user_id', user.id)
        .eq('month', month)
        .select()
        .single()
      if (error) throw error
      return data as MonthlySnapshot
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly_snapshot', user?.id, month] })
      queryClient.invalidateQueries({ queryKey: snapshotsQueryKey(user?.id, 6) })
      queryClient.invalidateQueries({ queryKey: snapshotsQueryKey(user?.id, 12) })
    },
  })
}

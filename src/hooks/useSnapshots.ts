import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MonthlySnapshot } from '@/lib/types'
import { useAuth } from './useAuth'

export function snapshotsQueryKey(userId: string | undefined, months: number) {
  return ['monthly_snapshots', userId, months] as const
}

/** Last N monthly snapshots, oldest first — used for trend charts and MoM comparisons. */
export function useSnapshots(months = 12) {
  const { user } = useAuth()
  return useQuery({
    queryKey: snapshotsQueryKey(user?.id, months),
    queryFn: async (): Promise<MonthlySnapshot[]> => {
      const { data, error } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('user_id', user!.id)
        .order('month', { ascending: false })
        .limit(months)
      if (error) throw error
      return (data as MonthlySnapshot[]).reverse()
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export interface AccountStatus {
  status: 'active' | 'suspended'
  reason: string | null
  suspended_until: string | null
  sessions_revoked_at: string | null
}

/**
 * The signed-in person's account status (suspended or not, and whether an admin ended their sessions).
 * Re-checked every minute and on focus. Fails open — if the lookup fails the app carries on as normal; the
 * database still enforces suspension on every write.
 */
export function useAccountStatus() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['account_status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_account_status')
      if (error) throw error
      return data as AccountStatus
    },
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    meta: { silent: true },
  })
}

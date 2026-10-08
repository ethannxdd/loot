import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/**
 * Feature flags (Migration 025). An admin can switch a feature on for everyone or for one person from
 * /admin/flags, with no deploy. Flags fail closed: if the lookup fails (e.g. the migration hasn't been run),
 * every flag reads as off and nothing breaks.
 */
export function featureFlagsQuery(userId: string | undefined) {
  return {
    queryKey: ['feature_flags', userId] as const,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_feature_flags')
      if (error) throw error
      return (data ?? {}) as Record<string, boolean>
    },
  }
}

export function useFeatureFlags() {
  const { user } = useAuth()
  return useQuery({
    ...featureFlagsQuery(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silent: true },
  })
}

export function useFeature(key: string): boolean {
  const { data } = useFeatureFlags()
  return data?.[key] === true
}

/** Flags marked public can be read before sign-in (e.g. email codes on the sign-in page). */
export function usePublicFeature(key: string): boolean {
  const { data } = useQuery({
    queryKey: ['public_feature_flags'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_feature_flags')
      if (error) throw error
      return (data ?? {}) as Record<string, boolean>
    },
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silent: true },
  })
  return data?.[key] === true
}

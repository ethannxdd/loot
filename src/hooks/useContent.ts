import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { resolveContent, type ResolvedContent } from '@/lib/content'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/**
 * Published content (Migration 030 app_content()), cached for an hour and validated. Until the RPC exists, or if it
 * fails, every value is the bundled default — content problems never break a page (Rule 24).
 */
export function useContent(): ResolvedContent {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['app_content', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('app_content')
      if (error) throw error
      return (data ?? {}) as Record<string, unknown>
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: false,
    meta: { silent: true },
  })
  return useMemo(() => resolveContent(data), [data])
}

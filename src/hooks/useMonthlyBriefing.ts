import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { computeBriefing } from '@/lib/briefing'
import { supabase } from '@/lib/supabase'
import type { MonthlyBriefing, MonthlySnapshot } from '@/lib/types'
import { useAuth } from './useAuth'

export function briefingsQueryKey(userId: string | undefined) {
  return ['monthly_briefings', userId] as const
}

export function useMonthlyBriefings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: briefingsQueryKey(user?.id),
    queryFn: async (): Promise<MonthlyBriefing[]> => {
      const { data, error } = await supabase
        .from('monthly_briefings')
        .select('*')
        .eq('user_id', user!.id)
        .order('month', { ascending: false })
      if (error) throw error
      return data as MonthlyBriefing[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

function useUpsertBriefing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, observations, recommendation }: { month: string; observations: string[]; recommendation: string }) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase
        .from('monthly_briefings')
        .upsert({ user_id: user.id, month, observations, recommendation }, { onConflict: 'user_id,month' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: briefingsQueryKey(user?.id) }),
  })
}

/**
 * The most recent locked (closed) month gets an auto-generated briefing the first time
 * it's seen, per "Briefing Card: auto-generated on first day of month after close."
 */
export function useLatestBriefing(lockedSnapshots: MonthlySnapshot[]) {
  const { data: briefings = [], isLoading } = useMonthlyBriefings()
  const upsert = useUpsertBriefing()
  const generatedFor = useRef<string | null>(null)

  const sorted = [...lockedSnapshots].sort((a, b) => a.month.localeCompare(b.month))
  const latestClosed = sorted[sorted.length - 1]
  const previousClosed = sorted[sorted.length - 2] ?? null

  useEffect(() => {
    if (!latestClosed) return
    if (briefings.some((b) => b.month === latestClosed.month)) return
    if (generatedFor.current === latestClosed.month) return
    generatedFor.current = latestClosed.month
    const { observations, recommendation } = computeBriefing(latestClosed, previousClosed)
    upsert.mutate({ month: latestClosed.month, observations, recommendation })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestClosed?.month, briefings.length])

  const latest = briefings[0] ?? null
  return { latest, isLoading }
}

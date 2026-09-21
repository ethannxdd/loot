import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IncomeStream, NewIncomeStream } from '@/lib/types'
import { useAuth } from './useAuth'

export function incomeStreamsQueryKey(userId: string | undefined) {
  return ['income_streams', userId] as const
}

export function useIncomeStreams() {
  const { user } = useAuth()
  return useQuery({
    queryKey: incomeStreamsQueryKey(user?.id),
    queryFn: async (): Promise<IncomeStream[]> => {
      const { data, error } = await supabase
        .from('income_streams')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as IncomeStream[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

function useStreamsMutation<TVars>(fn: (vars: TVars, userId: string) => Promise<void>) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: TVars) => {
      if (!user) throw new Error('Not signed in')
      await fn(vars, user.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incomeStreamsQueryKey(user?.id) }),
  })
}

export function useAddIncomeStream() {
  return useStreamsMutation<NewIncomeStream>(async (stream, userId) => {
    const { error } = await supabase.from('income_streams').insert({ ...stream, user_id: userId })
    if (error) throw error
  })
}

export function useUpdateIncomeStream() {
  return useStreamsMutation<{ id: string; patch: Partial<IncomeStream> }>(async ({ id, patch }) => {
    const { error } = await supabase.from('income_streams').update(patch).eq('id', id)
    if (error) throw error
  })
}

export function useDeleteIncomeStream() {
  return useStreamsMutation<string>(async (id) => {
    const { error } = await supabase.from('income_streams').delete().eq('id', id)
    if (error) throw error
  })
}

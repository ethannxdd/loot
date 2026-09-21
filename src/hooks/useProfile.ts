import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchProfile, profileQueryKey } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { useAuth } from './useAuth'

/** Fetches the current user's profiles row. Disabled until a user is signed in. */
export function useProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: profileQueryKey(user?.id),
    queryFn: () => fetchProfile(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  })
}

/** Patches the current user's profile row and updates the cache. */
export function useUpdateProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKey(user?.id), data)
    },
  })
}

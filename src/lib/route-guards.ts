import type { QueryClient } from '@tanstack/react-query'
import type { AuthContextValue } from '@/context/AuthContext'
import { fetchProfile, profileQueryKey } from './profile'
import type { Profile } from './types'

export interface RouterContext {
  auth: AuthContextValue
  queryClient: QueryClient
}

/**
 * Returns the signed-in user's profile, fetching and caching it if needed.
 * Returns null if there is no signed-in user, or if the fetch fails (e.g. the
 * profiles row hasn't been created yet by the signup trigger).
 */
export async function getProfileOrNull(context: RouterContext): Promise<Profile | null> {
  const userId = context.auth.user?.id
  if (!userId) return null
  try {
    return await context.queryClient.ensureQueryData({
      queryKey: profileQueryKey(userId),
      queryFn: () => fetchProfile(userId),
    })
  } catch {
    return null
  }
}

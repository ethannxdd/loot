import { supabase } from './supabase'
import type { Profile } from './types'

export function profileQueryKey(userId: string | undefined) {
  return ['profile', userId] as const
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data as Profile
}

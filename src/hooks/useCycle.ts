import type { QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { cycleFor, cycleForKey, cycleMonthLabel, type Cycle, type PaydaySettings } from '@/lib/cycle'
import { monthLabel } from '@/lib/money'
import type { Profile } from '@/lib/types'
import { featureFlagsQuery, useFeature } from './useFeatures'
import { useProfile } from './useProfile'

/** Payday settings that count — null when payday cycles are off (flag) or no payday is set (calendar months). */
export function paydaySettings(profile: Pick<Profile, 'payday_day' | 'payday_rule'> | null | undefined, live: boolean): PaydaySettings | null {
  if (!live || !profile || profile.payday_day == null) return null
  return { payday_day: profile.payday_day, payday_rule: profile.payday_rule ?? 'previous_working_day' }
}

/**
 * The current Loot cycle. With `live_cycle` off (or no payday set) this is the calendar month, so everything that
 * reads it behaves exactly as before Phase 6.
 */
export function useLiveCycle(): { live: boolean; settings: PaydaySettings | null; cycle: Cycle } {
  const live = useFeature('live_cycle')
  const { data: profile } = useProfile()
  const day = new Date().toDateString()
  const paydayDay = live ? profile?.payday_day : null
  const paydayRule = profile?.payday_rule
  const settings = useMemo(
    () => paydaySettings({ payday_day: paydayDay, payday_rule: paydayRule }, live),
    [paydayDay, paydayRule, live],
  )
  // Recompute when the day or the payday settings change.
  const cycle = useMemo(() => cycleFor(new Date(), settings), [day, settings])
  return { live, settings, cycle }
}

/** Same as useLiveCycle, for code outside React that has the query client (snapshot keeping). */
export function currentCycleKey(queryClient: QueryClient, userId: string, profile: Profile): string {
  const flags = queryClient.getQueryData<Record<string, boolean>>(featureFlagsQuery(userId).queryKey)
  return cycleFor(new Date(), paydaySettings(profile, flags?.live_cycle === true)).key
}

/**
 * Labels for snapshot month keys: "Oct 2026" on calendar months, "Oct pay" / "Oct pay · 23 Oct – 24 Nov" once payday
 * cycles are on and a payday is set.
 */
export function useMonthLabels() {
  const { settings } = useLiveCycle()
  return useMemo(
    () => ({
      short: (key: string) => (settings ? cycleMonthLabel(key, settings) : monthLabel(key)),
      long: (key: string) => (settings ? cycleForKey(key, settings).label : monthLabel(key)),
      /** "October" or "Oct pay" — for headings like "… in review". */
      name: (key: string) => {
        if (settings) return cycleMonthLabel(key, settings)
        const [y, m] = key.split('-').map(Number)
        return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long' })
      },
    }),
    [settings],
  )
}

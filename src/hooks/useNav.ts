import { mobileTabsFor, navGroupsFor } from '@/lib/nav'
import { useFeatureFlags } from './useFeatures'

/** Nav groups and mobile tabs for the signed-in person's feature flags. */
export function useNav() {
  const { data: flags } = useFeatureFlags()
  return { groups: navGroupsFor(flags), tabs: mobileTabsFor(flags) }
}

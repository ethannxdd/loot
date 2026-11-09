import {
  CalendarClock,
  ChartColumn,
  Calculator,
  FileSearch,
  Flame,
  GitCompare,
  HandCoins,
  Hourglass,
  Landmark,
  LayoutGrid,
  ReceiptText,
  Settings,
  Sparkles,
  Split,
  Sprout,
  Target,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only shown when this feature flag is on (Phase 6 features ship behind flags). */
  flag?: string
  /** Only shown when this feature flag is off — keeps today's layout for people without the flag. */
  unlessFlag?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Every nav item, grouped (§9 of the Phase 6 plan). Items carrying `flag` appear once that feature is on; with every
 * Phase 6 flag off this resolves to exactly the pre-Phase-6 navigation.
 */
const ALL_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Summary', icon: LayoutGrid },
      { to: '/stats', label: 'Stats', icon: ChartColumn },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/spending', label: 'Spending', icon: ReceiptText, flag: 'live_cycle' },
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/wishlist', label: 'Wishlist', icon: Hourglass, flag: 'wishlist' },
      { to: '/checker', label: 'Can I afford it?', icon: Sparkles, unlessFlag: 'live_cycle' },
      { to: '/statement', label: 'Statements', icon: FileSearch },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/stokvels', label: 'Stokvels', icon: HandCoins, flag: 'stokvels' },
      { to: '/splits', label: 'Splits', icon: Split, flag: 'splits' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { to: '/checker', label: 'Can I afford it?', icon: Sparkles, flag: 'live_cycle' },
      { to: '/tools', label: 'Tools', icon: Wrench, flag: 'tools' },
      { to: '/planner', label: 'Salary planner', icon: Calculator },
      { to: '/compare', label: 'Compare plans', icon: GitCompare },
      { to: '/future', label: 'Future you', icon: Sprout, flag: 'future_you' },
      { to: '/tax', label: 'Tax centre', icon: Landmark },
    ],
  },
  {
    label: 'Stay ahead',
    items: [
      { to: '/renewals', label: 'Renewals & prices', icon: CalendarClock, flag: 'renewals' },
      { to: '/challenges', label: 'Challenges', icon: Flame, flag: 'challenges' },
    ],
  },
  {
    label: 'Other',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

export type Flags = Record<string, boolean | undefined> | undefined

function visible(item: NavItem, flags: Flags): boolean {
  if (item.flag && flags?.[item.flag] !== true) return false
  if (item.unlessFlag && flags?.[item.unlessFlag] === true) return false
  return true
}

/** The nav groups for this person's feature flags (empty groups dropped). */
export function navGroupsFor(flags: Flags): NavGroup[] {
  return ALL_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, flags)) })).filter((g) => g.items.length > 0)
}

/** The pre-Phase-6 navigation (every flag off). */
export const NAV_GROUPS: NavGroup[] = navGroupsFor({})

const SUMMARY: NavItem = { to: '/dashboard', label: 'Summary', icon: LayoutGrid }
const EXPENSES: NavItem = { to: '/expenses', label: 'Expenses', icon: Wallet }
const GOALS: NavItem = { to: '/goals', label: 'Goals', icon: Target }
const STATS: NavItem = { to: '/stats', label: 'Stats', icon: ChartColumn }

/** The 5 mobile bottom tabs — a curated subset of the full nav. */
export const MOBILE_TABS: NavItem[] = [SUMMARY, EXPENSES, { to: '/statement', label: 'Statement', icon: FileSearch }, GOALS, STATS]

/** D7: with payday cycles on, Spending takes the Statements tab (Statements moves to the menu — a monthly task). */
export function mobileTabsFor(flags: Flags): NavItem[] {
  if (flags?.live_cycle === true) return [SUMMARY, { to: '/spending', label: 'Spending', icon: ReceiptText }, EXPENSES, GOALS, STATS]
  return MOBILE_TABS
}

/** True when `pathname` is the nav item's page or one of its children (e.g. /goals/abc → Goals). */
export function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

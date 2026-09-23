import {
  ChartColumn,
  Calculator,
  FileSearch,
  GitCompare,
  Landmark,
  LayoutGrid,
  Settings,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
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
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/checker', label: 'Can I afford it?', icon: Sparkles },
      { to: '/statement', label: 'Statements', icon: FileSearch },
    ],
  },
  {
    label: 'Planning',
    items: [
      { to: '/planner', label: 'Salary planner', icon: Calculator },
      { to: '/compare', label: 'Compare plans', icon: GitCompare },
      { to: '/tax', label: 'Tax centre', icon: Landmark },
    ],
  },
  {
    label: 'Other',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

/** The 5 mobile bottom tabs — a curated subset of the full nav. */
export const MOBILE_TABS: NavItem[] = [
  { to: '/dashboard', label: 'Summary', icon: LayoutGrid },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/statement', label: 'Statement', icon: FileSearch },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/stats', label: 'Stats', icon: ChartColumn },
]

/** True when `pathname` is the nav item's page or one of its children (e.g. /goals/abc → Goals). */
export function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

import {
  BarChart3,
  Calculator,
  FileSearch,
  GitCompare,
  Landmark,
  LayoutDashboard,
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
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/stats', label: 'Stats', icon: BarChart3 },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/checker', label: 'Checker', icon: Sparkles },
      { to: '/statement', label: 'Statement Analysis', icon: FileSearch },
    ],
  },
  {
    label: 'Planning',
    items: [
      { to: '/planner', label: 'Planner', icon: Calculator },
      { to: '/compare', label: 'Compare Plans', icon: GitCompare },
      { to: '/tax', label: 'Tax Centre', icon: Landmark },
    ],
  },
  {
    label: 'Other',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

/** The 5 mobile bottom tabs — a curated subset of the full nav. */
export const MOBILE_TABS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/statement', label: 'Statement', icon: FileSearch },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
]

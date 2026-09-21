/** The 25-category ruleset — see LOOT-SCHEMA.md "Quick reference — all 25 categories". */
export const EXPENSE_CATEGORIES = [
  'housing',
  'transport',
  'vehicle_finance',
  'insurance',
  'medical_aid',
  'debt_repayments',
  'groceries',
  'eating_out',
  'coffee_drinks',
  'household',
  'clothing_shopping',
  'health_beauty',
  'subscriptions',
  'entertainment',
  'tech_gadgets',
  'phone_airtime',
  'giving_charity',
  'education',
  'childcare',
  'pets',
  'savings',
  'investments',
  'side_business',
  'travel_holidays',
  'government_admin',
  'other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  housing: 'Housing',
  transport: 'Transport',
  vehicle_finance: 'Vehicle finance',
  insurance: 'Insurance',
  medical_aid: 'Medical aid',
  debt_repayments: 'Debt repayments',
  groceries: 'Groceries',
  eating_out: 'Eating out',
  coffee_drinks: 'Coffee & drinks',
  household: 'Household',
  clothing_shopping: 'Clothing & shopping',
  health_beauty: 'Health & beauty',
  subscriptions: 'Subscriptions',
  entertainment: 'Entertainment',
  tech_gadgets: 'Tech & gadgets',
  phone_airtime: 'Phone & airtime',
  giving_charity: 'Giving & charity',
  education: 'Education',
  childcare: 'Childcare',
  pets: 'Pets',
  savings: 'Savings',
  investments: 'Investments',
  side_business: 'Side business',
  travel_holidays: 'Travel & holidays',
  government_admin: 'Government & admin',
  other: 'Other',
}

import {
  Baby,
  Briefcase,
  Car,
  Clapperboard,
  Coffee,
  CreditCard,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  MoreHorizontal,
  PawPrint,
  PiggyBank,
  Plane,
  RefreshCw,
  Shield,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  housing: Home,
  transport: Car,
  vehicle_finance: Car,
  insurance: Shield,
  medical_aid: HeartPulse,
  debt_repayments: CreditCard,
  groceries: ShoppingCart,
  eating_out: UtensilsCrossed,
  coffee_drinks: Coffee,
  household: Sofa,
  clothing_shopping: Shirt,
  health_beauty: Sparkles,
  subscriptions: RefreshCw,
  entertainment: Clapperboard,
  tech_gadgets: Laptop,
  phone_airtime: Smartphone,
  giving_charity: HeartHandshake,
  education: GraduationCap,
  childcare: Baby,
  pets: PawPrint,
  savings: PiggyBank,
  investments: TrendingUp,
  side_business: Briefcase,
  travel_holidays: Plane,
  government_admin: Landmark,
  other: MoreHorizontal,
}

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category as ExpenseCategory] ?? MoreHorizontal
}

/** "Saving & Growing" categories — shown separately (in green) on the dashboard breakdown. */
export const GROWTH_CATEGORIES: ReadonlySet<ExpenseCategory> = new Set(['savings', 'investments'])

/** Chart colour assigned per category, cycling through the 5 chart tokens. */
const CHART_TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const

export function categoryChartToken(category: string): (typeof CHART_TOKENS)[number] {
  const index = EXPENSE_CATEGORIES.indexOf(category as ExpenseCategory)
  return CHART_TOKENS[index >= 0 ? index % CHART_TOKENS.length : 0]
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ExpenseCategory] ?? category
}

/** Savings goal categories — a smaller, purpose-oriented set. */
export const GOAL_CATEGORIES = [
  'emergency_fund',
  'travel',
  'home',
  'vehicle',
  'education',
  'wedding',
  'debt_payoff',
  'tech',
  'other',
] as const
export type GoalCategory = (typeof GOAL_CATEGORIES)[number]

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  emergency_fund: 'Emergency fund',
  travel: 'Travel',
  home: 'Home',
  vehicle: 'Vehicle',
  education: 'Education',
  wedding: 'Wedding',
  debt_payoff: 'Debt payoff',
  tech: 'Tech',
  other: 'Other',
}

export const GOAL_CATEGORY_ICONS: Record<GoalCategory, LucideIcon> = {
  emergency_fund: Shield,
  travel: Plane,
  home: Home,
  vehicle: Car,
  education: GraduationCap,
  wedding: HeartHandshake,
  debt_payoff: CreditCard,
  tech: Laptop,
  other: PiggyBank,
}

export function goalCategoryIcon(category: string): LucideIcon {
  return GOAL_CATEGORY_ICONS[category as GoalCategory] ?? PiggyBank
}

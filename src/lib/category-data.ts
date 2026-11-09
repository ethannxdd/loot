/** Category keys and labels with no UI dependencies — shared with the Supabase edge functions. */

/** The 26-category ruleset — see LOOT-SCHEMA.md "Quick reference" (family_support added in Phase 6, D15). */
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
  'family_support',
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
  family_support: 'Family support',
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

/** "Saving & Growing" categories — shown separately (in green) on the dashboard breakdown. */
export const GROWTH_CATEGORIES: ReadonlySet<ExpenseCategory> = new Set(['savings', 'investments'])

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ExpenseCategory] ?? category
}

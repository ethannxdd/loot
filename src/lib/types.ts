/** Mirrors public.profiles — see LOOT-SCHEMA.md Migration 001. */
export interface Profile {
  id: string
  display_name: string | null
  currency_code: string
  pay_frequency: string
  gross_income: number
  net_income: number
  safety_buffer_pct: number
  onboarded_at: string | null
  works_from_home: boolean
  provisional_taxpayer: boolean
  household_view: boolean
  multi_currency_enabled: boolean
  debt_strategy: string | null
  debt_extra_payment: number
  auto_allocation_mode: string
  auto_contribution_timing: string
  email_notifications: boolean
  push_notifications: boolean
  push_token: string | null
  tutorial_completed: boolean
  feature_discovery: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const CURRENCIES = [
  'ZAR',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'NZD',
  'AED',
  'BWP',
  'NAD',
  'ZMW',
  'MZN',
  'KES',
  'NGN',
] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  ZAR: 'South African Rand (ZAR)',
  USD: 'US Dollar (USD)',
  EUR: 'Euro (EUR)',
  GBP: 'British Pound (GBP)',
  AUD: 'Australian Dollar (AUD)',
  CAD: 'Canadian Dollar (CAD)',
  NZD: 'New Zealand Dollar (NZD)',
  AED: 'UAE Dirham (AED)',
  BWP: 'Botswana Pula (BWP)',
  NAD: 'Namibian Dollar (NAD)',
  ZMW: 'Zambian Kwacha (ZMW)',
  MZN: 'Mozambican Metical (MZN)',
  KES: 'Kenyan Shilling (KES)',
  NGN: 'Nigerian Naira (NGN)',
}

export const PAY_FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const
export type PayFrequency = (typeof PAY_FREQUENCIES)[number]

export const EXPENSE_FREQUENCIES = ['monthly', 'weekly', 'annual', 'once-off'] as const
export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number]

/** Mirrors public.expenses — see LOOT-SCHEMA.md Migration 002. */
export interface Expense {
  id: string
  user_id: string
  name: string
  category: string
  amount: number
  frequency: ExpenseFrequency
  is_fixed: boolean
  due_day: number | null
  notify_enabled: boolean
  notify_lead_days: number
  work_related: boolean
  original_amount: number | null
  original_currency: string | null
  exchange_rate: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type NewExpense = Pick<Expense, 'name' | 'category' | 'amount' | 'frequency' | 'is_fixed'> &
  Partial<
    Pick<
      Expense,
      | 'due_day'
      | 'notify_enabled'
      | 'notify_lead_days'
      | 'work_related'
      | 'original_amount'
      | 'original_currency'
      | 'exchange_rate'
    >
  >

/** Mirrors public.income_streams — see LOOT-SCHEMA.md Migration 003. */
export type IncomeFrequency = 'monthly' | 'biweekly' | 'weekly' | 'yearly'

export interface IncomeStream {
  id: string
  user_id: string
  name: string
  gross_amount: number
  net_amount: number
  frequency: IncomeFrequency
  is_active: boolean
  created_at: string
  updated_at: string
}

export type NewIncomeStream = Pick<IncomeStream, 'name' | 'gross_amount' | 'net_amount' | 'frequency'>

/** Mirrors public.savings_goals — see LOOT-SCHEMA.md Migration 004. */
export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  category: string
  target_amount: number
  current_amount: number
  target_date: string | null
  note: string | null
  priority: number
  sort_order: number
  weight: number
  progress_mode: string
  is_paused: boolean
  resume_date: string | null
  is_completed: boolean
  completed_at: string | null
  last_auto_period: string | null
  created_at: string
  updated_at: string
}

export type NewGoal = Pick<SavingsGoal, 'name' | 'category' | 'target_amount'> &
  Partial<Pick<SavingsGoal, 'target_date' | 'note' | 'current_amount' | 'sort_order' | 'progress_mode' | 'weight'>>

/** Mirrors public.goal_contributions — see LOOT-SCHEMA.md Migration 005. */
export interface GoalContribution {
  id: string
  goal_id: string
  user_id: string
  amount: number
  note: string | null
  created_at: string
}

/** Mirrors public.monthly_snapshots — see LOOT-SCHEMA.md Migration 006. */
export interface MonthlySnapshot {
  id: string
  user_id: string
  month: string // 'YYYY-MM-01'
  currency_code: string
  gross_income: number
  net_income: number
  total_expenses: number
  disposable_income: number
  savings_rate: number
  expenses_by_category: Record<string, number>
  assets_total: number | null
  liabilities_total: number | null
  net_worth: number | null
  locked_at: string | null
  close_notes: string | null
  created_at: string
  updated_at: string
}

/** Mirrors public.spending_benchmarks — see LOOT-SCHEMA.md Migration 019. */
export interface SpendingBenchmark {
  income_bracket: string
  category: string
  avg_pct: number
  sample_size: number
}

export type AffordabilityVerdict = 'comfortable' | 'tight' | 'not-recommended'

/** Mirrors public.affordability_checks — see LOOT-SCHEMA.md Migration 007. */
export interface AffordabilityCheck {
  id: string
  user_id: string
  item_name: string
  amount: number
  currency_code: string
  is_recurring: boolean
  verdict: AffordabilityVerdict
  reasoning: string
  disposable_at_check: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Salary Planner + Debt Payoff — Phase 3
// ---------------------------------------------------------------------------

export interface PlannerExpenseItem {
  name: string
  amount: number
}

export interface PlannerPhase {
  name: string
  gross_income: number
  expenses: PlannerExpenseItem[]
}

/** Mirrors public.planner_plans — see LOOT-SCHEMA.md Migration 008. `phases` is jsonb. */
export interface PlannerPlan {
  id: string
  user_id: string
  name: string
  tax_rate_pct: number
  phases: PlannerPhase[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewPlannerPlan = Pick<PlannerPlan, 'name' | 'tax_rate_pct' | 'phases'> &
  Partial<Pick<PlannerPlan, 'notes'>>

export const DEBT_ACCOUNT_TYPES = [
  'credit_card',
  'store_card',
  'personal_loan',
  'vehicle_finance',
  'student_loan',
  'home_loan',
  'other',
] as const
export type DebtAccountType = (typeof DEBT_ACCOUNT_TYPES)[number]

export const DEBT_ACCOUNT_TYPE_LABELS: Record<DebtAccountType, string> = {
  credit_card: 'Credit card',
  store_card: 'Store card',
  personal_loan: 'Personal loan',
  vehicle_finance: 'Vehicle finance',
  student_loan: 'Student loan',
  home_loan: 'Home loan',
  other: 'Other',
}

/** Mirrors public.debts — see LOOT-SCHEMA.md Migration 009. */
export interface Debt {
  id: string
  user_id: string
  name: string
  account_type: DebtAccountType
  balance: number
  interest_rate: number
  min_payment: number
  created_at: string
  updated_at: string
}

export type NewDebt = Pick<Debt, 'name' | 'account_type' | 'balance' | 'interest_rate' | 'min_payment'>

// ---------------------------------------------------------------------------
// Net Worth — Phase 4
// ---------------------------------------------------------------------------

export const NET_WORTH_ASSET_CATEGORIES = [
  'cash',
  'investments',
  'retirement',
  'property',
  'vehicle',
  'other_asset',
] as const
export const NET_WORTH_LIABILITY_CATEGORIES = [
  'home_loan',
  'vehicle_finance',
  'credit_card',
  'personal_loan',
  'student_loan',
  'other_liability',
] as const
export type NetWorthCategory =
  | (typeof NET_WORTH_ASSET_CATEGORIES)[number]
  | (typeof NET_WORTH_LIABILITY_CATEGORIES)[number]

export const NET_WORTH_CATEGORY_LABELS: Record<NetWorthCategory, string> = {
  cash: 'Cash & savings',
  investments: 'Investments',
  retirement: 'Retirement / RA',
  property: 'Property',
  vehicle: 'Vehicle',
  other_asset: 'Other asset',
  home_loan: 'Home loan',
  vehicle_finance: 'Vehicle finance',
  credit_card: 'Credit card',
  personal_loan: 'Personal loan',
  student_loan: 'Student loan',
  other_liability: 'Other liability',
}

/** Mirrors public.net_worth_items — see LOOT-SCHEMA.md Migration 010. */
export interface NetWorthItem {
  id: string
  user_id: string
  kind: 'asset' | 'liability'
  category: NetWorthCategory
  label: string
  value: number
  depreciation_pct: number
  created_at: string
  updated_at: string
}

export type NewNetWorthItem = Pick<NetWorthItem, 'kind' | 'category' | 'label' | 'value'> &
  Partial<Pick<NetWorthItem, 'depreciation_pct'>>

// ---------------------------------------------------------------------------
// Notifications — Phase 4
// ---------------------------------------------------------------------------

export const NOTIFICATION_KINDS = [
  'upcoming_debit',
  'tax_deadline',
  'subscription_anomaly',
  'spending_anomaly',
  'goal_milestone',
  'monthly_close_ready',
  'briefing_ready',
  'score_change',
  'household_invite',
  'system',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** A client-computed notification candidate, not yet persisted — see src/lib/notifications.ts. */
export interface NewNotificationCandidate {
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  dedupe_key: string
}

/** Mirrors public.notifications — see LOOT-SCHEMA.md Migration 011. */
export interface AppNotification {
  id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  dedupe_key: string
  read_at: string | null
  created_at: string
  updated_at: string
}

/** Mirrors public.spending_alerts — see LOOT-SCHEMA.md Migration 012. */
export interface SpendingAlert {
  id: string
  user_id: string
  month: string
  category: string
  actual: number
  average: number
  pct_above: number
  dismissed: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Statement Analysis — Phase 3
// ---------------------------------------------------------------------------

export type BankId = 'fnb' | 'capitec'

export interface ParsedTransaction {
  date: string // ISO yyyy-mm-dd
  description: string
  amount: number // positive = credit (in), negative = debit (out)
  balance: number | null
  category: string | null // classified expense category, null = unclassified
}

/** Mirrors public.statement_analyses — see LOOT-SCHEMA.md Migration 013. */
export interface StatementAnalysis {
  id: string
  user_id: string
  bank: BankId
  statement_month: string | null
  total_income: number
  total_spent: number
  category_totals: Record<string, number>
  subscription_items: { service_name: string; amount: number; last_charged: string }[]
  created_at: string
}

/** Mirrors public.subscription_reviews — see LOOT-SCHEMA.md Migration 014. */
export interface SubscriptionReview {
  id: string
  user_id: string
  service_name: string
  amount: number
  last_charged: string | null
  marked_cancel: boolean
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Tax Centre — Phase 3
// ---------------------------------------------------------------------------

export const EMPLOYMENT_TYPES = ['salaried', 'self_employed', 'both', 'retired', 'other'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

/** Mirrors public.tax_profile — see LOOT-SCHEMA.md Migrations 015 + 020. */
export interface TaxProfile {
  id: string
  user_id: string
  age: number
  employment_type: EmploymentType
  is_provisional_taxpayer: 'yes' | 'no'
  home_office_enabled: 'yes' | 'no'
  home_office_area_m2: number
  home_total_area_m2: number
  has_travel_allowance: boolean
  has_company_car: boolean
  has_ra: boolean
  ra_provider: string | null
  has_investment_income: boolean
  has_medical_aid: boolean
  medical_dependants: number
  created_at: string
  updated_at: string
}

export type NewTaxProfile = Partial<Omit<TaxProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

/** Mirrors public.tax_year_data — see LOOT-SCHEMA.md Migration 015. */
export interface TaxYearData {
  id: string
  user_id: string
  tax_year: string
  ra_contributions: number
  medical_aid_contributions: number
  home_office_deduction: number
  travel_deduction: number
  travel_km: number
  donations: number
  professional_development: number
  created_at: string
  updated_at: string
}

export type NewTaxYearData = Partial<
  Omit<TaxYearData, 'id' | 'user_id' | 'tax_year' | 'created_at' | 'updated_at'>
>

// ---------------------------------------------------------------------------
// Loot Score + Bureau Scores — Phase 4
// ---------------------------------------------------------------------------

export interface ScoreFactors {
  dti: number
  payment_consistency: number
  savings_rate: number
  utilisation: number
  expense_consistency: number
}

/** Mirrors public.budge_scores — see LOOT-SCHEMA.md Migration 016. */
export interface BudgeScore {
  id: string
  user_id: string
  month: string
  score: number
  factors: ScoreFactors
  created_at: string
  updated_at: string
}

/** Mirrors public.bureau_scores — see LOOT-SCHEMA.md Migration 016. */
export interface BureauScore {
  id: string
  user_id: string
  bureau: string
  score: number
  estimated_score: number | null
  gap: number | null
  factors: Record<string, unknown>
  reported_on: string
  created_at: string
  updated_at: string
}

export type NewBureauScore = Pick<BureauScore, 'bureau' | 'score' | 'reported_on'>

// ---------------------------------------------------------------------------
// Loot Assistant — Phase 4
// ---------------------------------------------------------------------------

/** Mirrors public.assistant_conversations — see LOOT-SCHEMA.md Migration 017. */
export interface AssistantConversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

/** Mirrors public.assistant_messages — see LOOT-SCHEMA.md Migration 017. */
export interface AssistantMessage {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Households — Phase 4
// ---------------------------------------------------------------------------

/** Mirrors public.households — see LOOT-SCHEMA.md Migration 018. */
export interface Household {
  id: string
  owner_id: string
  created_at: string
  updated_at: string
}

/** Mirrors public.household_members — see LOOT-SCHEMA.md Migration 018. */
export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  created_at: string
}

/** Mirrors public.household_invites — see LOOT-SCHEMA.md Migration 018. */
export interface HouseholdInvite {
  id: string
  household_id: string
  inviter_id: string
  email: string
  token: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export type NewHouseholdInvite = Pick<HouseholdInvite, 'email'>

// ---------------------------------------------------------------------------
// Monthly Briefings — Phase 4
// ---------------------------------------------------------------------------

/** Mirrors public.monthly_briefings — see LOOT-SCHEMA.md Migration 019. */
export interface MonthlyBriefing {
  id: string
  user_id: string
  month: string
  observations: string[]
  recommendation: string
  created_at: string
  updated_at: string
}

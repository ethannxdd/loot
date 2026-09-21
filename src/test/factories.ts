import type { Debt, Expense, SavingsGoal, TaxProfile, TaxYearData } from '@/lib/types'

let counter = 0
const id = (prefix: string) => `${prefix}-${++counter}`

export function makeGoal(over: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: id('goal'),
    user_id: 'u1',
    name: 'Goal',
    category: 'other',
    target_amount: 10_000,
    current_amount: 0,
    target_date: null,
    note: null,
    priority: 0,
    sort_order: 0,
    weight: 1,
    progress_mode: 'manual',
    is_paused: false,
    resume_date: null,
    is_completed: false,
    completed_at: null,
    last_auto_period: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function makeDebt(over: Partial<Debt> = {}): Debt {
  return {
    id: id('debt'),
    user_id: 'u1',
    name: 'Debt',
    account_type: 'credit_card',
    balance: 10_000,
    interest_rate: 20,
    min_payment: 500,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as Debt
}

export function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: id('exp'),
    user_id: 'u1',
    name: 'Expense',
    category: 'other',
    amount: 100,
    frequency: 'monthly',
    deleted_at: null,
    ...over,
  } as Expense
}

export function makeTaxProfile(over: Partial<TaxProfile> = {}): TaxProfile {
  return {
    id: 'tp',
    user_id: 'u1',
    age: 30,
    employment_type: 'salaried',
    is_provisional_taxpayer: 'no',
    home_office_enabled: 'no',
    home_office_area_m2: 0,
    home_total_area_m2: 0,
    has_travel_allowance: false,
    has_company_car: false,
    has_ra: false,
    ra_provider: null,
    has_investment_income: false,
    has_medical_aid: false,
    medical_dependants: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function makeTaxYear(over: Partial<TaxYearData> = {}): TaxYearData {
  return {
    id: 'ty',
    user_id: 'u1',
    tax_year: '2026/27',
    ra_contributions: 0,
    medical_aid_contributions: 0,
    home_office_deduction: 0,
    travel_deduction: 0,
    travel_km: 0,
    donations: 0,
    professional_development: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

import type { MonthlySnapshot } from '@/lib/types'

export function makeSnapshot(over: Partial<MonthlySnapshot> = {}): MonthlySnapshot {
  return {
    id: `snap-${over.month ?? counter++}`,
    user_id: 'u1',
    month: '2026-08-01',
    currency_code: 'ZAR',
    gross_income: 30_000,
    net_income: 24_000,
    total_expenses: 15_000,
    disposable_income: 9_000,
    savings_rate: 37.5,
    expenses_by_category: {},
    assets_total: null,
    liabilities_total: null,
    net_worth: null,
    locked_at: null,
    close_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

import type { Debt, MonthlySnapshot, ScoreFactors } from './types'

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

/**
 * Loot Score — a locally-computed credit-health *estimate*, not a real bureau score.
 * Five weighted factors (see LOOT-FEATURES.md "Advanced Feature Cards — Loot Score Card"):
 * DTI ratio 30%, payment consistency 25%, savings rate 20%, credit utilisation 15%,
 * expense consistency 10%. Each factor is scored 0–999 before weighting. Where the
 * schema has no direct data source (e.g. actual missed-payment history), a documented
 * proxy is used — the `score_calibration` / `score_corrections` tables exist precisely
 * so this estimate can be tuned against real bureau scores over time (see bureau-score.ts).
 */

function dtiFactor(debtRepaymentsMonthly: number, grossIncome: number): number {
  if (grossIncome <= 0) return 500
  const dti = debtRepaymentsMonthly / grossIncome
  return 999 * clamp01(1 - dti / 0.5)
}

/** Proxy: how many of the last N months stayed under the 36% DTI flag threshold. */
function paymentConsistencyFactor(snapshots: MonthlySnapshot[]): number {
  if (snapshots.length === 0) return 500
  const flaggedCount = snapshots.filter((s) => {
    const debtRepay = s.expenses_by_category['debt_repayments'] ?? 0
    return s.gross_income > 0 && debtRepay / s.gross_income > 0.36
  }).length
  return 999 * clamp01(1 - flaggedCount / snapshots.length)
}

function savingsRateFactor(savingsRatePct: number): number {
  return 999 * clamp01(savingsRatePct / 25)
}

/** Proxy: revolving-debt balance (credit/store cards) against an assumed limit of 3x monthly net income. */
function utilisationFactor(debts: Debt[], netIncome: number): number {
  const revolving = debts
    .filter((d) => d.account_type === 'credit_card' || d.account_type === 'store_card')
    .reduce((sum, d) => sum + d.balance, 0)
  const assumedLimit = Math.max(netIncome * 3, 1)
  return 999 * clamp01(1 - revolving / assumedLimit)
}

/** Coefficient of variation of total_expenses across recent months — lower variance scores higher. */
function expenseConsistencyFactor(snapshots: MonthlySnapshot[]): number {
  if (snapshots.length < 2) return 700
  const values = snapshots.map((s) => s.total_expenses)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean <= 0) return 700
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  const cv = Math.sqrt(variance) / mean
  return 999 * clamp01(1 - cv * 2)
}

export interface BudgeScoreResult {
  score: number
  factors: ScoreFactors
}

const WEIGHTS = { dti: 0.3, payment_consistency: 0.25, savings_rate: 0.2, utilisation: 0.15, expense_consistency: 0.1 }

export function computeBudgeScore(latest: MonthlySnapshot, recentSnapshots: MonthlySnapshot[], debts: Debt[]): BudgeScoreResult {
  const debtRepay = latest.expenses_by_category['debt_repayments'] ?? 0

  const factors: ScoreFactors = {
    dti: dtiFactor(debtRepay, latest.gross_income),
    payment_consistency: paymentConsistencyFactor(recentSnapshots),
    savings_rate: savingsRateFactor(latest.savings_rate),
    utilisation: utilisationFactor(debts, latest.net_income),
    expense_consistency: expenseConsistencyFactor(recentSnapshots),
  }

  const score = Math.round(
    factors.dti * WEIGHTS.dti +
      factors.payment_consistency * WEIGHTS.payment_consistency +
      factors.savings_rate * WEIGHTS.savings_rate +
      factors.utilisation * WEIGHTS.utilisation +
      factors.expense_consistency * WEIGHTS.expense_consistency
  )

  return { score: Math.max(0, Math.min(999, score)), factors }
}

export function scoreColor(score: number): 'green' | 'amber' | 'red' {
  if (score > 700) return 'green'
  if (score >= 550) return 'amber'
  return 'red'
}

export interface ScoreRecommendation {
  factor: keyof ScoreFactors
  message: string
}

export function scoreRecommendations(factors: ScoreFactors): ScoreRecommendation[] {
  const recs: ScoreRecommendation[] = []
  if (factors.dti < 700) recs.push({ factor: 'dti', message: 'Your debt repayments are a large share of your income — paying down higher-interest debt first will improve this the fastest.' })
  if (factors.payment_consistency < 700) recs.push({ factor: 'payment_consistency', message: 'Your debt-to-income ratio has crossed 36% in recent months — building a buffer before taking on new debt will help.' })
  if (factors.savings_rate < 700) recs.push({ factor: 'savings_rate', message: 'Increasing your savings rate, even by a few percent, meaningfully improves this factor.' })
  if (factors.utilisation < 700) recs.push({ factor: 'utilisation', message: 'Your revolving credit balances look high relative to your income — paying these down improves utilisation quickly.' })
  if (factors.expense_consistency < 700) recs.push({ factor: 'expense_consistency', message: 'Your monthly spending varies a lot — smoothing it out (e.g. budgeting for irregular costs) helps this factor.' })
  return recs
}

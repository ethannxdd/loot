import { categoryLabel, EXPENSE_CATEGORIES } from './category-data'
import type { ResolvedContent } from './content'
import { cyclesBack, cycleFor, type PaydaySettings } from './cycle'
import { tfsaRoom, type TfsaContribution } from './future'
import { checkAffordability, disposableIncome, monthlyEquivalent, safetyBufferAmount } from './money'
import { netFromGrossSars } from './planner-math'
import { budgetsFor, safeToSpend, spendByCategory, UNSORTED, type SpendEntry } from './spending'
import { runway, type RunwayScenario } from './tools/runway'
import type { Expense, Profile, SavingsGoal } from './types'

/**
 * Runs Ask Loot's tool calls in the browser (Rule 25) with the person's live data and the same src/lib functions the
 * rest of the app uses — so "Can I afford a R6,000 PS5?" gives exactly the Checker's verdict. Results are small JSON
 * objects with rounded rand figures; no names of other people, no notes.
 */

export interface ToolData {
  profile: Profile
  expenses: Expense[]
  goals: SavingsGoal[]
  entries: SpendEntry[]
  payday: PaydaySettings | null
  tfsa: TfsaContribution[]
  content: ResolvedContent
  today?: Date
}

type Args = Record<string, unknown>
const r0 = (n: number) => Math.round(n)

function savingsBalance(goals: SavingsGoal[]) {
  return goals.filter((g) => !g.is_completed).reduce((s, g) => s + g.current_amount, 0)
}

export function runTool(name: string, args: Args, d: ToolData): Record<string, unknown> {
  const today = d.today ?? new Date()
  const net = d.profile.net_income
  const disposable = disposableIncome(net, d.expenses)
  const buffer = safetyBufferAmount(net, d.profile.safety_buffer_pct)
  switch (name) {
    case 'check_affordability': {
      const amount = Number(args.amount)
      if (!(amount > 0)) return { error: 'amount must be a positive number' }
      const r = checkAffordability({
        itemName: String(args.item ?? 'it').slice(0, 60),
        amount,
        isRecurring: Boolean(args.recurring),
        disposableIncome: disposable,
        safetyBuffer: buffer,
        savingsBalance: savingsBalance(d.goals),
        emergencyFundTarget: d.goals.find((g) => g.category === 'emergency_fund')?.target_amount,
      })
      return { verdict: r.verdict, reasoning: r.reasoning, amount: r0(amount), recurring: Boolean(args.recurring) }
    }
    case 'cycle_status': {
      const cycle = cycleFor(today, d.payday, today)
      const s = safeToSpend({ disposable, buffer, budgets: budgetsFor(d.expenses), entries: d.entries, cycle })
      return {
        cycle: cycle.label,
        days_left: s.daysLeft,
        safe_to_spend: r0(s.safe),
        per_day: r0(s.perDay),
        planned: r0(s.planned),
        unplanned_spend: r0(s.unplanned),
        over_budget: r0(s.over),
        state: s.state,
        budgets_left: Object.fromEntries(Object.entries(s.budgetsLeft).map(([k, v]) => [categoryLabel(k), r0(v)])),
        spends_logged: s.entryCount,
      }
    }
    case 'category_spend': {
      const category = String(args.category ?? '')
      if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { error: `unknown category; use one of ${EXPENSE_CATEGORIES.join(', ')}` }
      const n = Math.min(6, Math.max(1, Math.round(Number(args.cycles) || 3)))
      const budget = budgetsFor(d.expenses).find((b) => b.category === category)?.budget ?? 0
      return {
        category: categoryLabel(category),
        monthly_budget: r0(budget),
        cycles: cyclesBack(n, d.payday, today).map((c) => ({ cycle: c.shortLabel, spent: r0(spendByCategory(d.entries, c)[category] ?? 0) })),
      }
    }
    case 'top_spending': {
      const cycle = cycleFor(today, d.payday, today)
      const by = spendByCategory(d.entries, cycle)
      return {
        cycle: cycle.label,
        spends: Object.entries(by)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k, v]) => ({ category: k === UNSORTED ? 'Not sorted yet' : categoryLabel(k), spent: r0(v) })),
        fixed_commitments: r0(d.expenses.filter((e) => !e.deleted_at && e.is_fixed).reduce((s, e) => s + monthlyEquivalent(e), 0)),
      }
    }
    case 'goal_status': {
      const name = String(args.name ?? '').toLowerCase()
      const goals = d.goals.filter((g) => !name || g.name.toLowerCase().includes(name))
      return {
        goals: goals.map((g) => ({
          name: g.name,
          saved: r0(g.current_amount),
          target: r0(g.target_amount),
          percent: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
          target_date: g.target_date,
          completed: g.is_completed,
        })),
      }
    }
    case 'what_if': {
      const scenario = (['lose_income', 'pay_cut', 'new_baby', 'custom'].includes(String(args.scenario)) ? args.scenario : 'lose_income') as RunwayScenario
      const spend = d.expenses.filter((e) => !e.deleted_at && !['savings', 'investments'].includes(e.category)).reduce((s, e) => s + monthlyEquivalent(e), 0)
      const r = runway({
        savings: savingsBalance(d.goals),
        takeHome: net,
        essentials: spend,
        cuttable: 0,
        scenario,
        payCutPct: Number(args.pay_cut_pct) || 0,
        extraMonthly: Number(args.extra_monthly) || 0,
        otherIncome: Number(args.other_income) || 0,
        cut: false,
      }, today)
      return {
        scenario,
        savings_used: r0(savingsBalance(d.goals)),
        monthly_shortfall: r0(Math.max(0, r.shortfall)),
        months: r.months === null ? 'does not run out' : Math.round(r.months * 10) / 10,
        runs_out_on: r.runsOutOn?.toISOString().slice(0, 10) ?? null,
      }
    }
    case 'tax_estimate': {
      const gross = Number(args.gross_monthly)
      if (!(gross > 0)) return { error: 'gross_monthly must be positive' }
      const takeHome = netFromGrossSars(gross)
      return { gross_monthly: r0(gross), tax_monthly: r0(gross - takeHome), take_home_monthly: r0(takeHome), note: 'Income tax only (primary rebate); excludes UIF, pension and medical credits.' }
    }
    case 'tfsa_room': {
      const room = tfsaRoom(d.tfsa, d.content.tfsa_limits, today)
      return {
        tax_year: room.taxYear,
        contributed_this_year: r0(room.thisYear),
        annual_limit: room.annualLimit,
        room_this_year: r0(room.roomThisYear),
        lifetime_contributed: r0(room.lifetime),
        lifetime_limit: room.lifetimeLimit,
        monthly_to_max: room.monthlyToMax,
      }
    }
    default:
      return { error: `unknown tool ${name}` }
  }
}

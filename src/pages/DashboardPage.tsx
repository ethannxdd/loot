import { Link } from '@tanstack/react-router'
import { Sparkles, Users, Wallet } from 'lucide-react'
import { AvailableLootHero } from '@/components/dashboard/AvailableLootHero'
import { BriefingCard } from '@/components/dashboard/BriefingCard'
import { ForecastCard } from '@/components/dashboard/ForecastCard'
import { Lootflow } from '@/components/dashboard/Lootflow'
import { LootScoreCard } from '@/components/dashboard/LootScoreCard'
import { MonthlyCloseCard } from '@/components/dashboard/MonthlyCloseCard'
import { QuickAddExpense } from '@/components/dashboard/QuickAddExpense'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { StatCard } from '@/components/dashboard/StatCard'
import { UpcomingDebits } from '@/components/dashboard/UpcomingDebits'
import { WhereYourLootGoes } from '@/components/dashboard/WhereYourLootGoes'
import { useExpenses } from '@/hooks/useExpenses'
import { useHouseholdView } from '@/hooks/useHousehold'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { disposableIncome, healthLevel, previousMonthSnapshot, savingsRate, totalMonthlyExpenses } from '@/lib/money'
import { getGreeting } from '@/lib/utils'

export function DashboardPage() {
  const { data: profile } = useProfile()
  const household = useHouseholdView()
  const { data: snapshots = [] } = useSnapshots(6)
  const { data: ownExpenses = [] } = useExpenses()

  // In household view these are the combined figures for everyone; otherwise just the user's own.
  const expenses = household.combinedExpenses
  const firstName = profile?.display_name?.split(' ')[0] ?? 'there'
  const netIncome = household.netIncome
  const totalExpenses = totalMonthlyExpenses(expenses)
  const disposable = disposableIncome(netIncome, expenses)
  const rate = savingsRate(disposable, netIncome)
  const health = healthLevel(rate)

  // Month-on-month deltas compare against the last EARLIER month, and only for the individual view —
  // snapshots are per-person, so they can't be compared against a combined household figure.
  const previous = household.active ? null : previousMonthSnapshot(snapshots)
  const disposableDelta = previous ? disposable - previous.disposable_income : null
  const expensesDelta = previous ? totalExpenses - previous.total_expenses : null
  const incomeDelta = previous ? netIncome - previous.net_income : null
  const sparkline = (pick: (s: (typeof snapshots)[number]) => number) => (household.active ? [] : snapshots.map(pick))

  const isEmpty = expenses.length === 0
  const needsIncome = profile !== undefined && profile.net_income <= 0

  return (
    <div className="animate-enter space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.025em]">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your loot.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {household.available && (
            <button
              type="button"
              onClick={household.toggle}
              disabled={household.isToggling}
              aria-pressed={household.active}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                household.active
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={14} strokeWidth={1.75} />
              Household view
            </button>
          )}
          <Link to="/checker" className="btn btn-secondary">
            Run a check
          </Link>
          <Link to="/expenses" search={{ add: true }} className="btn btn-primary">
            Add expense
          </Link>
        </div>
      </header>

      {household.active && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Showing combined figures for you{household.partnerNames.length > 0 && ` and ${household.partnerNames.join(', ')}`}.
          Month-on-month trends stay individual.
        </p>
      )}

      {needsIncome && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border border-caution/30">
          <p className="text-sm text-muted-foreground">
            Your income is set to zero, so Loot can't work out what's left over.
          </p>
          <Link to="/settings" className="btn btn-ghost !h-8 !px-3 !text-xs">
            Set your income
          </Link>
        </div>
      )}

      {isEmpty ? (
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Wallet size={32} strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Nothing tracked yet.</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your recurring costs and Loot will show your real monthly position — the money
              you have left after everything is accounted for.
            </p>
          </div>
          <div className="w-full max-w-xs text-left">
            <QuickAddExpense />
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4" data-tutorial="dashboard-stats">
            <AvailableLootHero
              value={disposable}
              delta={disposableDelta}
              sparkline={sparkline((s) => s.disposable_income)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                variant="chip"
                label="Loot going out"
                value={totalExpenses}
                delta={expensesDelta}
                invertDeltaColor
                sparkline={sparkline((s) => s.total_expenses)}
                color="#AF72FE"
              />
              <StatCard
                variant="chip"
                label="Loot coming in"
                value={netIncome}
                delta={incomeDelta}
                sparkline={sparkline((s) => s.net_income)}
                color="#5BC0EB"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <WhereYourLootGoes expenses={expenses} />
                <Lootflow
                  netIncome={netIncome}
                  totalExpenses={totalExpenses}
                  deltaVsLastMonth={disposableDelta}
                  health={health}
                />
              </div>

              <RecentActivity expenses={expenses} />

              <div className="space-y-3">
                <div className="overline-label px-1">Advanced</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <LootScoreCard />
                  {/* Forecast, score, close and briefing are personal — they always use the user's own numbers. */}
                  <ForecastCard snapshots={snapshots} expenses={ownExpenses} netIncome={profile?.net_income ?? 0} />
                  <MonthlyCloseCard />
                  <BriefingCard snapshots={snapshots} />
                </div>
              </div>
            </div>

            <div className="space-y-5 self-start" data-tutorial="dashboard-quick-actions">
              <Link
                to="/checker"
                className="card-purple card-hover flex items-center gap-3 px-5 py-4"
              >
                <Sparkles size={20} strokeWidth={1.75} className="shrink-0 text-secondary" />
                <div>
                  <p className="text-sm font-bold">Can you afford it?</p>
                  <p className="text-xs text-muted-foreground">Run a quick affordability check</p>
                </div>
              </Link>
              <UpcomingDebits expenses={expenses} />
              <QuickAddExpense />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

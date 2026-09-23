import { Link } from '@tanstack/react-router'
import { ArrowDownRight, ArrowUpRight, Plus, Sparkles, Users, Wallet } from 'lucide-react'
import { AvailableLootHero } from '@/components/dashboard/AvailableLootHero'
import { BriefingCard } from '@/components/dashboard/BriefingCard'
import { ForecastCard } from '@/components/dashboard/ForecastCard'
import { GoalsSummaryCard } from '@/components/dashboard/GoalsSummaryCard'
import { LootScoreTile } from '@/components/dashboard/LootScoreTile'
import { MetricTile } from '@/components/dashboard/MetricTile'
import { MonthlyCloseCard } from '@/components/dashboard/MonthlyCloseCard'
import { QuickAddExpense } from '@/components/dashboard/QuickAddExpense'
import { QuickCheckCard } from '@/components/dashboard/QuickCheckCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { UpcomingDebits } from '@/components/dashboard/UpcomingDebits'
import { WhereYourLootGoes } from '@/components/dashboard/WhereYourLootGoes'
import { PageHeader } from '@/components/ui/PageHeader'
import { useExpenses } from '@/hooks/useExpenses'
import { useHouseholdView } from '@/hooks/useHousehold'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { GROWTH_CATEGORIES } from '@/lib/categories'
import {
  disposableIncome,
  healthLevel,
  monthlyEquivalent,
  previousMonthSnapshot,
  savingsRate,
  totalMonthlyExpenses,
} from '@/lib/money'
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
  const growing = expenses
    .filter((e) => !e.deleted_at && GROWTH_CATEGORIES.has(e.category as never))
    .reduce((s, e) => s + monthlyEquivalent(e), 0)
  const committed = totalExpenses - growing
  const disposable = disposableIncome(netIncome, expenses)
  const rate = savingsRate(disposable, netIncome)
  const health = healthLevel(rate)

  // Month-on-month deltas compare against the last EARLIER month, and only for the individual view —
  // snapshots are per-person, so they can't be compared against a combined household figure.
  const previous = household.active ? null : previousMonthSnapshot(snapshots)
  const disposableDelta = previous ? disposable - previous.disposable_income : null
  const expensesDelta = previous ? totalExpenses - previous.total_expenses : null
  const incomeDelta = previous ? netIncome - previous.net_income : null
  const sparkline = (pick: (s: (typeof snapshots)[number]) => number) =>
    household.active ? [] : [...snapshots].sort((a, b) => a.month.localeCompare(b.month)).map(pick)

  const isEmpty = expenses.length === 0
  const needsIncome = profile !== undefined && profile.net_income <= 0
  const today = new Date()
  const monthName = today.toLocaleDateString('en-ZA', { month: 'long' })

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow={today.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={
          <>
            {getGreeting()}
            <span className="hidden sm:inline">, {firstName}</span>
          </>
        }
        actions={
          <>
            {household.available && (
              <button
                type="button"
                onClick={household.toggle}
                disabled={household.isToggling}
                aria-pressed={household.active}
                className={`btn !min-h-[38px] !px-3.5 !text-[13px] ${household.active ? 'btn-accent' : 'btn-secondary'}`}
              >
                <Users size={15} strokeWidth={2} />
                Household
              </button>
            )}
            <Link to="/checker" className="btn btn-secondary hidden sm:inline-flex">
              <Sparkles size={16} strokeWidth={2.2} />
              Run a check
            </Link>
            <Link to="/expenses" search={{ add: true }} className="btn btn-primary">
              <Plus size={16} strokeWidth={2.4} />
              Add expense
            </Link>
          </>
        }
      />

      {household.active && (
        <p className="-mt-2 text-[13px] text-muted-foreground">
          Showing combined figures for you
          {household.partnerNames.length > 0 && ` and ${household.partnerNames.join(', ')}`}. Month-on-month trends stay
          individual.
        </p>
      )}

      {needsIncome && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !py-4">
          <p className="text-[14px] text-muted-foreground">
            Your income is set to zero, so Loot can&apos;t work out what&apos;s left over.
          </p>
          <Link to="/settings" className="btn btn-ghost !min-h-9 !text-[13px]">
            Set your income
          </Link>
        </div>
      )}

      {isEmpty ? (
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
            <Wallet size={30} strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">Nothing tracked yet</h2>
            <p className="max-w-sm text-[14px] text-muted-foreground">
              Add your recurring costs and Loot will show your real monthly position — the money you have left after
              everything is accounted for.
            </p>
          </div>
          <div className="w-full max-w-xs text-left">
            <QuickAddExpense />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8" data-tutorial="dashboard-stats">
            <AvailableLootHero
              value={disposable}
              delta={disposableDelta}
              netIncome={netIncome}
              committed={committed}
              growing={growing}
              health={health}
              savingsRate={rate}
              monthName={monthName}
            />
          </div>
          <div className="lg:col-span-4" data-tutorial="dashboard-quick-actions">
            <QuickCheckCard />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-12">
            <MetricTile
              label="Coming in"
              icon={ArrowDownRight}
              color="var(--chart-1)"
              value={netIncome}
              delta={incomeDelta}
              sparkline={sparkline((s) => s.net_income)}
              fallbackNote="Your monthly take-home pay"
            />
            <MetricTile
              label="Going out"
              icon={ArrowUpRight}
              color="var(--chart-2)"
              value={totalExpenses}
              delta={expensesDelta}
              invertDelta
              sparkline={sparkline((s) => s.total_expenses)}
              fallbackNote="All monthly commitments"
            />
            <div className="col-span-2 sm:col-span-1">
              <LootScoreTile />
            </div>
          </div>

          <div className="lg:col-span-7">
            <WhereYourLootGoes expenses={expenses} />
          </div>
          <div className="lg:col-span-5">
            <UpcomingDebits expenses={expenses} />
          </div>

          {/* Forecast, score, goals, close and briefing are personal — they always use the user's own numbers. */}
          <div className="lg:col-span-7">
            <ForecastCard
              snapshots={snapshots}
              expenses={ownExpenses}
              netIncome={profile?.net_income ?? 0}
              currentDisposable={disposableIncome(profile?.net_income ?? 0, ownExpenses)}
            />
          </div>
          <div className="lg:col-span-5">
            <GoalsSummaryCard />
          </div>

          <div className="lg:col-span-7">
            <RecentActivity expenses={expenses} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <BriefingCard snapshots={snapshots} />
            <MonthlyCloseCard />
          </div>
        </div>
      )}
    </div>
  )
}

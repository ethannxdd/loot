import { Link } from '@tanstack/react-router'
import { Sparkles, Wallet } from 'lucide-react'
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
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { disposableIncome, healthLevel, savingsRate, totalMonthlyExpenses } from '@/lib/money'
import { getGreeting } from '@/lib/utils'

export function DashboardPage() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: snapshots = [] } = useSnapshots(6)

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there'
  const netIncome = profile?.net_income ?? 0
  const totalExpenses = totalMonthlyExpenses(expenses)
  const disposable = disposableIncome(netIncome, expenses)
  const rate = savingsRate(disposable, netIncome)
  const health = healthLevel(rate)

  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null
  const disposableDelta = previous ? disposable - previous.disposable_income : null
  const expensesDelta = previous ? totalExpenses - previous.total_expenses : null
  const incomeDelta = previous ? netIncome - previous.net_income : null

  const isEmpty = expenses.filter((e) => !e.deleted_at).length === 0

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
        <div className="flex gap-2.5">
          <Link to="/checker" className="btn btn-secondary">
            Run a check
          </Link>
        </div>
      </header>

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
          <Link to="/expenses" className="btn btn-primary">
            Add expense
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-3" data-tutorial="dashboard-stats">
                <StatCard
                  label="Available loot"
                  value={disposable}
                  delta={disposableDelta}
                  sparkline={snapshots.map((s) => s.disposable_income)}
                  color="#C1FE72"
                />
                <StatCard
                  label="Loot going out"
                  value={totalExpenses}
                  delta={expensesDelta}
                  invertDeltaColor
                  sparkline={snapshots.map((s) => s.total_expenses)}
                  color="#AF72FE"
                />
                <StatCard
                  label="Loot coming in"
                  value={netIncome}
                  delta={incomeDelta}
                  sparkline={snapshots.map((s) => s.net_income)}
                  color="#5BC0EB"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="overline px-1">Advanced</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LootScoreCard />
                  <ForecastCard snapshots={snapshots} expenses={expenses} netIncome={netIncome} />
                  <MonthlyCloseCard />
                  <BriefingCard snapshots={snapshots} />
                </div>
              </div>
            </div>

            <div className="space-y-5" data-tutorial="dashboard-quick-actions">
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

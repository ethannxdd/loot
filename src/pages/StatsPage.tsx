import { useState } from 'react'
import { CheckHistoryList } from '@/components/checker/CheckHistoryList'
import { BenchmarksTab } from '@/components/stats/BenchmarksTab'
import { CategoryTrendsTab } from '@/components/stats/CategoryTrendsTab'
import { NetWorthTab } from '@/components/stats/NetWorthTab'
import { OverviewTab } from '@/components/stats/OverviewTab'
import { useAffordabilityChecks } from '@/hooks/useAffordabilityChecks'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'

const TABS = ['Overview', 'Category trends', 'Net worth', 'Benchmarks'] as const
type Tab = (typeof TABS)[number]

export function StatsPage() {
  const [tab, setTab] = useState<Tab>('Overview')
  const { data: profile } = useProfile()
  const { data: snapshots = [], isLoading: snapshotsLoading } = useSnapshots(12)
  const { data: checks = [] } = useAffordabilityChecks(100)

  return (
    <div className="animate-enter space-y-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your history, trends, and how you compare.
        </p>
      </header>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-fit rounded-[10px] border border-border bg-input p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 sm:px-3.5 text-xs font-semibold transition-colors ${
                tab === t ? 'bg-surface-3 text-foreground' : 'text-text-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {snapshotsLoading && tab !== 'Net worth' && <div className="skeleton h-64 rounded-2xl" />}
      {!snapshotsLoading && tab === 'Overview' && <OverviewTab snapshots={snapshots} />}
      {!snapshotsLoading && tab === 'Category trends' && <CategoryTrendsTab snapshots={snapshots} />}
      {tab === 'Net worth' && <NetWorthTab snapshots={snapshots} />}
      {!snapshotsLoading && tab === 'Benchmarks' && (
        <BenchmarksTab
          latestSnapshot={snapshots[snapshots.length - 1]}
          grossIncome={profile?.gross_income ?? 0}
        />
      )}

      {checks.length > 0 && (
        <section className="space-y-2">
          <div className="overline px-1">Affordability check history</div>
          <CheckHistoryList checks={checks} />
        </section>
      )}
    </div>
  )
}

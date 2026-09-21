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
  const { data: snapshots = [] } = useSnapshots(12)
  const { data: checks = [] } = useAffordabilityChecks(100)

  return (
    <div className="animate-enter space-y-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your history, trends, and how you compare.
        </p>
      </header>

      <div className="flex w-fit rounded-[10px] border border-border bg-input p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === t ? 'bg-surface-3 text-foreground' : 'text-text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab snapshots={snapshots} />}
      {tab === 'Category trends' && <CategoryTrendsTab snapshots={snapshots} />}
      {tab === 'Net worth' && <NetWorthTab snapshots={snapshots} />}
      {tab === 'Benchmarks' && (
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

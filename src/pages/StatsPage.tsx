import { useState } from 'react'
import { CheckHistoryList } from '@/components/checker/CheckHistoryList'
import { BenchmarksTab } from '@/components/stats/BenchmarksTab'
import { CategoryTrendsTab } from '@/components/stats/CategoryTrendsTab'
import { NetWorthTab } from '@/components/stats/NetWorthTab'
import { OverviewTab } from '@/components/stats/OverviewTab'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { useAffordabilityChecks } from '@/hooks/useAffordabilityChecks'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'

const TABS = ['Overview', 'Categories', 'Net worth', 'Benchmarks'] as const
type Tab = (typeof TABS)[number]

export function StatsPage() {
  const [tab, setTab] = useState<Tab>('Overview')
  const { data: profile } = useProfile()
  const { data: snapshots = [], isLoading: snapshotsLoading } = useSnapshots(12)
  const { data: checks = [] } = useAffordabilityChecks(100)

  return (
    <div className="animate-enter space-y-6">
      <PageHeader eyebrow="Overview" title="Stats" subtitle="Your history, trends, and how you compare." />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-tutorial="stats-tabs">
        <Segmented label="Stats view" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: t }))} />
      </div>

      {snapshotsLoading && tab !== 'Net worth' && <div className="skeleton h-64 rounded-[22px]" />}
      {!snapshotsLoading && tab === 'Overview' && <OverviewTab snapshots={snapshots} />}
      {!snapshotsLoading && tab === 'Categories' && <CategoryTrendsTab snapshots={snapshots} />}
      {tab === 'Net worth' && <NetWorthTab snapshots={snapshots} />}
      {!snapshotsLoading && tab === 'Benchmarks' && (
        <BenchmarksTab latestSnapshot={snapshots[snapshots.length - 1]} grossIncome={profile?.gross_income ?? 0} />
      )}

      {tab === 'Overview' && checks.length > 0 && (
        <section className="space-y-2">
          <h2 className="card-title px-1">Affordability checks</h2>
          <CheckHistoryList checks={checks} />
        </section>
      )}
    </div>
  )
}

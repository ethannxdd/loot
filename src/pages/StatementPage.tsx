import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AnalysisHistory } from '@/components/statement/AnalysisHistory'
import { CategoryBreakdown } from '@/components/statement/CategoryBreakdown'
import { DistributionChart } from '@/components/statement/DistributionChart'
import { SubscriptionAudit } from '@/components/statement/SubscriptionAudit'
import { UploadZone } from '@/components/statement/UploadZone'
import { useAddExpense } from '@/hooks/useExpenses'
import { useSaveStatementAnalysis, useStatementAnalyses } from '@/hooks/useStatementAnalyses'
import { useSubscriptionReviews, useUpsertSubscription } from '@/hooks/useSubscriptionReviews'
import {
  analyzeTransactions,
  detectAnomalies,
  detectSubscriptions,
  generateRecommendations,
  parseStatementFile,
  type CategoryAnomaly,
  type StatementSummary,
  type SubscriptionCandidate,
} from '@/lib/statement'
import { formatCurrency } from '@/lib/utils'
import type { BankId } from '@/lib/types'

export function StatementPage() {
  const [bank, setBank] = useState<BankId>('fnb')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<StatementSummary | null>(null)
  const [anomalies, setAnomalies] = useState<CategoryAnomaly[]>([])
  const [subscriptionCandidates, setSubscriptionCandidates] = useState<SubscriptionCandidate[]>([])
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({})
  const [syncOpen, setSyncOpen] = useState(false)
  const [savedThisRun, setSavedThisRun] = useState(false)

  const { data: analyses = [] } = useStatementAnalyses()
  const { data: subscriptions = [] } = useSubscriptionReviews()
  const saveAnalysis = useSaveStatementAnalysis()
  const upsertSubscription = useUpsertSubscription()
  const addExpense = useAddExpense()

  const recommendations = useMemo(
    () => (summary ? generateRecommendations(summary, anomalies, subscriptionCandidates) : []),
    [summary, anomalies, subscriptionCandidates]
  )

  async function handleFile(file: File) {
    setIsProcessing(true)
    setError(null)
    setSummary(null)
    setSavedThisRun(false)
    try {
      const transactions = await parseStatementFile(file, bank)
      if (transactions.length === 0) {
        setError(
          "Couldn't find any transactions in that file. Double-check the bank selection matches the statement, or try a different export format (PDF/CSV/OFX)."
        )
        return
      }
      const result = analyzeTransactions(transactions)
      setSummary(result)
      setAnomalies(detectAnomalies(result.categoryTotals, analyses))
      setSubscriptionCandidates(detectSubscriptions(result.transactions))
      setSyncSelection(Object.fromEntries(Object.keys(result.categoryTotals).map((c) => [c, false])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong reading that file.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleSaveAnalysis() {
    if (!summary) return
    saveAnalysis.mutate(
      {
        bank,
        statementMonth: summary.transactions[0]?.date.slice(0, 7) ?? null,
        totalIncome: summary.totalIncome,
        totalSpent: summary.totalSpent,
        categoryTotals: summary.categoryTotals,
        subscriptionItems: subscriptionCandidates.map((s) => ({
          service_name: s.serviceName,
          amount: s.amount,
          last_charged: s.lastCharged,
        })),
      },
      { onSuccess: () => setSavedThisRun(true) }
    )
    for (const sub of subscriptionCandidates) {
      upsertSubscription.mutate({ serviceName: sub.serviceName, amount: sub.amount, lastCharged: sub.lastCharged })
    }
  }

  function handleApplySync() {
    if (!summary) return
    const categoriesToSync = Object.entries(syncSelection).filter(([, checked]) => checked)
    for (const [category] of categoriesToSync) {
      const amount = summary.categoryTotals[category]
      if (!amount) continue
      addExpense.mutate({
        name: `${category} (from statement)`,
        category,
        amount,
        frequency: 'monthly',
        is_fixed: false,
      })
    }
    setSyncOpen(false)
  }

  return (
    <div className="animate-enter space-y-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Statement Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a bank statement and Loot will break it down by category — entirely on your device.
        </p>
      </header>

      <UploadZone bank={bank} onBankChange={setBank} onFile={handleFile} isProcessing={isProcessing} error={error} />

      {summary && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="card space-y-1">
              <div className="flex items-center gap-1.5 text-primary">
                <ArrowUpCircle size={14} strokeWidth={1.75} />
                <p className="overline !text-primary">Total in</p>
              </div>
              <p className="tnum text-lg">{formatCurrency(summary.totalIncome)}</p>
            </div>
            <div className="card space-y-1">
              <div className="flex items-center gap-1.5 text-secondary">
                <ArrowDownCircle size={14} strokeWidth={1.75} />
                <p className="overline !text-secondary">Total spent</p>
              </div>
              <p className="tnum text-lg">{formatCurrency(summary.totalSpent)}</p>
            </div>
            <div className="card space-y-1">
              <p className="overline">Net position</p>
              <p className={`tnum text-lg ${summary.netPosition < 0 ? 'text-alert' : 'text-primary'}`}>
                {formatCurrency(summary.netPosition)}
              </p>
            </div>
            <div className="card space-y-1">
              <p className="overline">Unclassified</p>
              <p className="tnum text-lg">{formatCurrency(summary.unclassifiedAmount)}</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CategoryBreakdown categoryTotals={summary.categoryTotals} transactions={summary.transactions} />
            <div className="space-y-5">
              <DistributionChart categoryTotals={summary.categoryTotals} />

              <div className="card-purple space-y-2 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} strokeWidth={1.75} className="text-secondary" />
                  <p className="text-sm font-bold">Recommendations</p>
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-secondary">·</span> {r}
                    </li>
                  ))}
                </ul>
              </div>

              {anomalies.length > 0 && (
                <div className="card space-y-2 border-caution/30">
                  <div className="flex items-center gap-2 text-caution">
                    <AlertTriangle size={16} strokeWidth={1.75} />
                    <p className="text-sm font-bold">Anomaly alerts</p>
                  </div>
                  {anomalies.map((a) => (
                    <p key={a.category} className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{a.category}</span> is{' '}
                      {a.pctAbove.toFixed(0)}% above your recent average ({formatCurrency(a.actual)} vs{' '}
                      {formatCurrency(a.average)}).
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card space-y-3">
            <button
              type="button"
              onClick={() => setSyncOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <RefreshCw size={15} strokeWidth={1.75} /> Sync with my Loot expenses
              </span>
              <span className="text-xs text-primary">{syncOpen ? 'Hide' : 'Show'}</span>
            </button>
            {syncOpen && (
              <div className="space-y-3 border-t border-hairline pt-3">
                <p className="text-xs text-muted-foreground">
                  Toggle categories to add this period's total as a variable expense in Loot.
                </p>
                {Object.entries(summary.categoryTotals).map(([category, amount]) => (
                  <label key={category} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={syncSelection[category] ?? false}
                        onChange={(e) => setSyncSelection((prev) => ({ ...prev, [category]: e.target.checked }))}
                        className="h-4 w-4 accent-primary"
                        style={{ width: 'auto' }}
                      />
                      {category}
                    </span>
                    <span className="tnum">{formatCurrency(amount)}</span>
                  </label>
                ))}
                <button type="button" onClick={handleApplySync} className="btn btn-primary w-full">
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveAnalysis}
              disabled={saveAnalysis.isPending || savedThisRun}
              className="btn btn-secondary"
            >
              {savedThisRun ? 'Saved to history' : 'Save this analysis'}
            </button>
          </div>
        </div>
      )}

      <SubscriptionAudit subscriptions={subscriptions} />
      <AnalysisHistory analyses={analyses} />
    </div>
  )
}

import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Info, KeyRound, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AnalysisHistory } from '@/components/statement/AnalysisHistory'
import { CategoryBreakdown } from '@/components/statement/CategoryBreakdown'
import { DistributionChart } from '@/components/statement/DistributionChart'
import { SubscriptionAudit } from '@/components/statement/SubscriptionAudit'
import { UnclassifiedPanel } from '@/components/statement/UnclassifiedPanel'
import { UploadZone } from '@/components/statement/UploadZone'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Switch } from '@/components/ui/Switch'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useAddExpense, useExpenses } from '@/hooks/useExpenses'
import { useSaveStatementAnalysis, useStatementAnalyses } from '@/hooks/useStatementAnalyses'
import { useSubscriptionReviews, useUpsertSubscription } from '@/hooks/useSubscriptionReviews'
import { categoryColor, categoryLabel, type ExpenseCategory } from '@/lib/categories'
import { monthLabel, monthlyEquivalent } from '@/lib/money'
import {
  analyzeTransactions,
  detectAnomalies,
  detectSubscriptions,
  generateRecommendations,
  parseStatementFile,
  PdfPasswordError,
  setMerchantCategory,
} from '@/lib/statement'
import type { BankId, ParsedTransaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface LoadedStatement {
  transactions: ParsedTransaction[]
  bank: BankId
  skippedTransfers: number
  fileName: string
}

export function StatementPage() {
  const [bank, setBank] = useState<BankId>('fnb')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<LoadedStatement | null>(null)
  // Bumped whenever the user files a merchant under a category, so the analysis is recomputed.
  const [overrideVersion, setOverrideVersion] = useState(0)
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({})
  const [syncOpen, setSyncOpen] = useState(false)
  const [confirmSync, setConfirmSync] = useState(false)
  const [savedThisRun, setSavedThisRun] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [passwordFile, setPasswordFile] = useState<{ file: File; wrong: boolean } | null>(null)
  const [password, setPassword] = useState('')

  const { data: analyses = [] } = useStatementAnalyses()
  const { data: subscriptions = [] } = useSubscriptionReviews()
  const { data: expenses = [] } = useExpenses()
  const saveAnalysis = useSaveStatementAnalysis()
  const upsertSubscription = useUpsertSubscription()
  const addExpense = useAddExpense()

  const summary = useMemo(
    () => (loaded ? analyzeTransactions(loaded.transactions) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, overrideVersion],
  )
  const anomalies = useMemo(
    () =>
      summary && loaded
        ? detectAnomalies(summary.categoryTotals, analyses, { bank: loaded.bank, month: summary.primaryMonth, months: summary.periodMonths })
        : [],
    [summary, loaded, analyses],
  )
  const subscriptionCandidates = useMemo(() => (summary ? detectSubscriptions(summary.transactions) : []), [summary])
  const recommendations = useMemo(
    () => (summary ? generateRecommendations(summary, anomalies, subscriptionCandidates) : []),
    [summary, anomalies, subscriptionCandidates],
  )

  async function processFile(file: File, pdfPassword?: string) {
    setIsProcessing(true)
    setError(null)
    setNotice(null)
    setSavedThisRun(false)
    try {
      const outcome = await parseStatementFile(file, bank, pdfPassword)
      setPasswordFile(null)
      setPassword('')
      if (outcome.transactions.length === 0) {
        setLoaded(null)
        setError(
          outcome.noText
            ? "That PDF has no readable text — it looks like a scan or photo. Download the statement again from your banking app or use the CSV export."
            : "Couldn't find any transactions in that file. Check the bank selection matches the statement, or try a different export (PDF, CSV or OFX).",
        )
        return
      }
      const usedBank = outcome.detectedBank ?? bank
      if (outcome.detectedBank) {
        setBank(outcome.detectedBank)
        setNotice(`That file looks like a ${outcome.detectedBank === 'fnb' ? 'FNB' : 'Capitec'} statement, so Loot read it that way.`)
      }
      setLoaded({ transactions: outcome.transactions, bank: usedBank, skippedTransfers: outcome.skippedTransfers, fileName: file.name })
      setSyncSelection({})
      setSyncOpen(false)
    } catch (e) {
      if (e instanceof PdfPasswordError) {
        setPasswordFile({ file, wrong: e.wrongPassword })
        setPassword('')
      } else {
        setLoaded(null)
        setError(e instanceof Error ? e.message : 'Something went wrong reading that file.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault()
    if (passwordFile && password) void processFile(passwordFile.file, password)
  }

  function assignMerchant(merchant: string, category: ExpenseCategory) {
    setMerchantCategory(merchant, category)
    setOverrideVersion((v) => v + 1)
    toast.success(`Filed under ${categoryLabel(category)} — Loot will remember this`)
  }

  async function handleSaveAnalysis() {
    if (!summary || !loaded) return
    setIsSaving(true)
    try {
      await saveAnalysis.mutateAsync({
        bank: loaded.bank,
        statementMonth: summary.primaryMonth,
        totalIncome: summary.totalIncome,
        totalSpent: summary.totalSpent,
        categoryTotals: summary.categoryTotals,
        subscriptionItems: subscriptionCandidates.map((s) => ({
          service_name: s.serviceName,
          amount: s.amount,
          last_charged: s.lastCharged,
        })),
      })
      // One at a time: each is a look-up-then-write, so running them together could create duplicates.
      for (const sub of subscriptionCandidates) {
        await upsertSubscription.mutateAsync({ serviceName: sub.serviceName, amount: sub.amount, lastCharged: sub.lastCharged })
      }
      setSavedThisRun(true)
      toast.success(summary.primaryMonth ? `${monthLabel(`${summary.primaryMonth}-01`)} analysis saved` : 'Analysis saved')
    } catch {
      // The global error toast already explains what failed; the button stays available to retry.
    } finally {
      setIsSaving(false)
    }
  }

  const monthlyFor = (category: string) => (summary ? (summary.categoryTotals[category] ?? 0) / summary.periodMonths : 0)
  const selectedCategories = Object.entries(syncSelection).filter(([c, on]) => on && summary?.categoryTotals[c])

  async function handleApplySync() {
    if (!summary) return
    const label = summary.primaryMonth ? monthLabel(`${summary.primaryMonth}-01`) : 'statement'
    let added = 0
    for (const [category] of selectedCategories) {
      const amount = Math.round(monthlyFor(category) * 100) / 100
      if (amount <= 0) continue
      try {
        await addExpense.mutateAsync({
          name: `${categoryLabel(category)} (from ${label} statement)`,
          category,
          amount,
          frequency: 'monthly',
          is_fixed: false,
        })
        added += 1
      } catch {
        break // the global error toast explains what went wrong; stop rather than half-apply silently
      }
    }
    setConfirmSync(false)
    if (added > 0) {
      setSyncSelection({})
      setSyncOpen(false)
      toast.success(`Added ${added} expense${added === 1 ? '' : 's'} to Loot`, { description: 'Find them under Expenses → Variable.' })
    }
  }

  const trackedInCategory = (category: string) =>
    expenses.filter((e) => !e.deleted_at && e.category === category).reduce((s, e) => s + monthlyEquivalent(e), 0)

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Statements"
        subtitle="Upload a bank statement and Loot will break it down by category — read entirely on your device."
      />

      <div data-tutorial="statement-upload"><UploadZone bank={bank} onBankChange={setBank} onFile={(file) => void processFile(file)} isProcessing={isProcessing} error={error} /></div>

      {passwordFile && (
        <form onSubmit={submitPassword} className="card animate-enter space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-caution/14 text-caution">
              <KeyRound size={16} strokeWidth={2} />
            </span>
            <h2 className="card-title">This statement is password protected</h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {passwordFile.wrong ? 'That password didn’t work — try again. ' : ''}
            Banks often lock statements with your ID number or a password you set. It’s used on this device to open
            the file and is never sent anywhere.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <PasswordInput
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PDF password"
                aria-label="PDF password"
              />
            </div>
            <button type="submit" disabled={!password || isProcessing} className="btn btn-primary shrink-0">
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              Unlock
            </button>
          </div>
        </form>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3.5 py-3 text-[13px] font-medium text-primary">
          <Info size={15} strokeWidth={2} /> {notice}
        </div>
      )}

      {summary && loaded && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-muted-foreground">
            <span>
              {loaded.fileName} · {summary.transactions.length} transactions
              {summary.from && summary.to && <> · {summary.from} to {summary.to}</>}
            </span>
            {loaded.skippedTransfers > 0 && (
              <span>
                {loaded.skippedTransfers} transfer{loaded.skippedTransfers === 1 ? '' : 's'} between your own accounts left out
              </span>
            )}
          </div>

          <section className="card-elevated grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:p-6">
            {[
              { label: 'Money in', value: summary.totalIncome, color: 'var(--chart-1)', icon: ArrowDownCircle },
              { label: 'Spent', value: summary.totalSpent, color: 'var(--chart-2)', icon: ArrowUpCircle },
              { label: 'Net position', value: summary.netPosition, color: summary.netPosition < 0 ? 'var(--alert)' : 'var(--accent)', icon: null },
              { label: 'Unclassified', value: summary.unclassifiedAmount, color: 'var(--caution)', icon: null },
            ].map((s, i) => (
              <div key={s.label} className={`px-1 sm:px-5 ${i > 0 ? 'sm:border-l sm:border-hairline' : 'sm:pl-0'}`}>
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
                  {s.label}
                </p>
                <p
                  className="tnum mt-1 text-[24px] font-bold tracking-[-0.03em]"
                  style={s.label === 'Net position' ? { color: s.color } : undefined}
                >
                  {formatCurrency(s.value)}
                </p>
              </div>
            ))}
          </section>

          <UnclassifiedPanel transactions={summary.unclassified} onAssign={assignMerchant} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CategoryBreakdown categoryTotals={summary.categoryTotals} transactions={summary.transactions} />
            <div className="space-y-5">
              <DistributionChart categoryTotals={summary.categoryTotals} />

              <div className="card-purple space-y-3 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles size={16} strokeWidth={2} />
                  </span>
                  <h3 className="card-title">What Loot noticed</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.map((r, i) => (
                    <li key={i} className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {anomalies.length > 0 && (
                <div className="card space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-caution/14 text-caution">
                      <AlertTriangle size={16} strokeWidth={2} />
                    </span>
                    <h3 className="card-title">Higher than usual</h3>
                  </div>
                  {anomalies.map((a) => (
                    <p key={a.category} className="text-[13.5px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{categoryLabel(a.category)}</span> is{' '}
                      {a.pctAbove.toFixed(0)}% above your recent average ({formatCurrency(a.actual)} vs{' '}
                      {formatCurrency(a.average)}).
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {Object.keys(summary.categoryTotals).length > 0 && (
            <div className="card space-y-3">
              <button
                type="button"
                onClick={() => setSyncOpen((v) => !v)}
                aria-expanded={syncOpen}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-fill">
                    <RefreshCw size={15} strokeWidth={2} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">Add to my Loot expenses</span>
                    <span className="block text-[12.5px] text-muted-foreground">Turn statement categories into monthly expenses</span>
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-primary">{syncOpen ? 'Hide' : 'Show'}</span>
              </button>
              {syncOpen && (
                <div className="space-y-3 border-t border-hairline pt-3">
                  <p className="text-[13px] text-muted-foreground">
                    Turn on the categories to add to Loot as monthly variable expenses
                    {summary.periodMonths > 1 && ` (this statement covers about ${summary.periodMonths} months, so amounts are averaged per month)`}.
                  </p>
                  <div className="divide-y divide-hairline rounded-xl bg-surface-2 px-4">
                  {Object.entries(summary.categoryTotals).map(([category]) => {
                    const tracked = trackedInCategory(category)
                    return (
                      <div key={category} className="py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: categoryColor(category) }} />
                            <span className="truncate">{categoryLabel(category)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="tnum text-[14px] font-semibold">{formatCurrency(monthlyFor(category))}/mo</span>
                            <Switch
                              checked={syncSelection[category] ?? false}
                              onChange={(on) => setSyncSelection((prev) => ({ ...prev, [category]: on }))}
                              label={`Add ${categoryLabel(category)}`}
                            />
                          </span>
                        </div>
                        {tracked > 0 && (
                          <span className="mt-1 block pl-5 text-[12.5px] text-caution">
                            You already track {formatCurrency(tracked)}/mo in this category — adding it would count twice.
                          </span>
                        )}
                      </div>
                    )
                  })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmSync(true)}
                    disabled={selectedCategories.length === 0}
                    className="btn btn-primary w-full"
                  >
                    Apply{selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ''}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveAnalysis()}
              disabled={isSaving || savedThisRun}
              className="btn btn-primary"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {savedThisRun ? 'Saved to history' : 'Save this analysis'}
            </button>
          </div>
        </div>
      )}

      <SubscriptionAudit subscriptions={subscriptions} />
      <AnalysisHistory analyses={analyses} />

      {confirmSync && summary && (
        <ConfirmModal
          title="Add these to your expenses?"
          confirmLabel={`Add ${selectedCategories.length} expense${selectedCategories.length === 1 ? '' : 's'}`}
          destructive={false}
          isPending={addExpense.isPending}
          onConfirm={() => void handleApplySync()}
          onCancel={() => setConfirmSync(false)}
        >
          <p className="mb-3">Loot will add these as monthly, variable expenses. You can edit or remove them any time.</p>
          <ul className="space-y-1">
            {selectedCategories.map(([category]) => (
              <li key={category} className="flex justify-between gap-3 text-foreground">
                <span>{categoryLabel(category)}</span>
                <span className="tnum">{formatCurrency(monthlyFor(category))}/mo</span>
              </li>
            ))}
          </ul>
        </ConfirmModal>
      )}
    </div>
  )
}

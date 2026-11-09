import { CreditCard, Hand, Loader2, Plus, ReceiptText, Split, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type Ref } from 'react'
import { toast } from 'sonner'
import { BudgetsCard } from '@/components/spending/BudgetsCard'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { useLogSpendSheet } from '@/context/LogSpendContext'
import { useLiveCycle } from '@/hooks/useCycle'
import { useDeleteSpend, useRestoreSpend, useSafeToSpend, useUpdateSpend } from '@/hooks/useSpendEntries'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, categoryColor, categoryIcon, categoryLabel } from '@/lib/categories'
import { cyclesBack } from '@/lib/cycle'
import { dateKey } from '@/lib/sa-calendar'
import { dayLabel, entriesInCycle, groupByDay, type SpendEntry } from '@/lib/spending'
import { formatCurrency, formatCurrencyExact } from '@/lib/utils'

type Filter = 'all' | 'unplanned' | 'over' | 'auto'

const SOURCE_META: Record<SpendEntry['source'], { label: string; icon: typeof Hand }> = {
  manual: { label: 'Logged by hand', icon: Hand },
  apple_pay: { label: 'Apple Pay', icon: CreditCard },
  split: { label: 'Split', icon: Split },
  stokvel: { label: 'Stokvel', icon: ReceiptText },
}

/** /spending (§3.2): the cycle's spend log, budgets and what's unplanned. */
export function SpendingPage() {
  const { settings, cycle: current } = useLiveCycle()
  const cycles = useMemo(() => cyclesBack(6, settings), [settings])
  const [cycleKey, setCycleKey] = useState(current.key)
  const cycle = cycles.find((c) => c.key === cycleKey) ?? current
  const stats = useSafeToSpend(cycle)
  const { openLog } = useLogSpendSheet()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<SpendEntry | null>(null)
  const editRef = useRef<HTMLElement>(null)

  const budgetCats = new Set(stats.budgets.map((b) => b.category))
  const inCycle = entriesInCycle(stats.entries, cycle)
  const toSort = inCycle.filter((e) => e.category == null)
  const filtered = inCycle.filter((e) => {
    if (filter === 'unplanned') return !e.category || !budgetCats.has(e.category)
    if (filter === 'over') return e.category != null && (stats.overByCategory[e.category] ?? 0) > 0
    if (filter === 'auto') return e.source === 'apple_pay'
    return true
  })
  const days = groupByDay(filtered)
  const budgetsLeft = Object.values(stats.budgetsLeft).reduce((s, v) => s + v, 0)
  const isCurrent = cycle.key === current.key

  function openEdit(entry: SpendEntry) {
    setEditing(entry)
    requestAnimationFrame(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow={cycle.calendar ? cycle.label : cycle.rangeLabel}
        title={
          <>
            Spending<span className="text-muted-foreground"> · {cycle.calendar ? cycle.start.toLocaleDateString('en-ZA', { month: 'short' }) : cycle.shortLabel}</span>
          </>
        }
        actions={
          <>
            <Select
              aria-label="Cycle"
              value={cycle.key}
              onValueChange={setCycleKey}
              className="!w-auto"
              options={cycles.map((c, i) => ({ value: c.key, label: i === 0 ? `${c.calendar ? c.label : c.shortLabel} (now)` : c.label }))}
            />
            <button type="button" onClick={() => openLog()} className="btn btn-primary" data-tutorial="spending-log" data-testid="spending-log">
              <Plus size={16} strokeWidth={2.4} />
              Log a spend
            </button>
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Spent this cycle', value: formatCurrency(Math.max(0, stats.totalSpent)) },
          { label: 'Unplanned', value: formatCurrency(Math.max(0, stats.unplanned)), valueColor: stats.unplanned > 0 ? 'var(--caution)' : undefined },
          { label: 'Budgets left', value: formatCurrency(budgetsLeft) },
          isCurrent
            ? {
                label: 'Per day',
                value: stats.state === 'over' ? 'Ease off' : formatCurrency(stats.perDay),
                valueColor: stats.state === 'over' ? 'var(--alert)' : undefined,
                sub: `${stats.daysLeft} day${stats.daysLeft === 1 ? '' : 's'} ${cycle.calendar ? 'left' : 'to payday'}`,
              }
            : {
                label: stats.safe >= 0 ? 'Finished ahead' : 'Finished over',
                value: formatCurrency(Math.abs(stats.safe)),
                valueColor: stats.safe >= 0 ? 'var(--accent)' : 'var(--alert)',
              },
        ]}
      />

      {toSort.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !py-4" data-testid="to-sort">
          <p className="text-[14px]">
            <b className="font-semibold">{toSort.length} to sort.</b>{' '}
            <span className="text-muted-foreground">Auto-captured spends with no category yet count as unplanned.</span>
          </p>
          <button type="button" onClick={() => openEdit(toSort[0])} className="btn btn-secondary !min-h-9 !text-[13px]">
            Sort the first one
          </button>
        </div>
      )}

      {editing && (
        <EditSpendSheet ref={editRef} key={editing.id} entry={editing} onClose={() => setEditing(null)} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <BudgetsCard budgets={stats.budgets} spentByCategory={stats.spentByCategory} cycle={cycle} full />
        </div>

        <section className="space-y-4 lg:col-span-7">
          <div className="-mx-1 overflow-x-auto px-1 [&_button]:whitespace-nowrap">
            <Segmented
              label="Filter spends"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unplanned', label: 'Unplanned' },
                { value: 'over', label: 'Over budget' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
          </div>

          {stats.isLoading ? (
            <div className="skeleton h-40 rounded-2xl" />
          ) : days.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-tint)] text-primary">
                <ReceiptText size={26} strokeWidth={1.8} />
              </span>
              <h2 className="text-[18px] font-bold tracking-[-0.02em]">
                {filter === 'all' ? (isCurrent ? 'Nothing logged this cycle yet' : 'Nothing was logged this cycle') : 'Nothing here'}
              </h2>
              <p className="max-w-sm text-[14px] text-muted-foreground">
                {filter === 'all'
                  ? 'Log what you spend as you go and Loot keeps Safe to spend and your budgets honest.'
                  : 'No spends match this filter.'}
              </p>
              {filter === 'all' && isCurrent && (
                <button type="button" onClick={() => openLog()} className="btn btn-primary mt-1">
                  <Plus size={16} strokeWidth={2.4} /> Log your first spend
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5" data-testid="spend-list">
              {days.map((d) => (
                <div key={d.day.getTime()}>
                  <div className="mb-1.5 flex items-baseline justify-between px-3">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{dayLabel(d.day)}</span>
                    <span className="tnum text-[13px] text-muted-foreground">{formatCurrencyExact(d.total)}</span>
                  </div>
                  <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
                    {d.entries.map((e, i) => {
                      const Icon = e.category ? categoryIcon(e.category) : ReceiptText
                      const Source = SOURCE_META[e.source].icon
                      const unplanned = !e.category || !budgetCats.has(e.category)
                      return (
                        <li key={e.id} className={i > 0 ? 'border-t border-hairline' : ''}>
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-fill"
                          >
                            <span
                              className="icon-tile !h-9 !w-9"
                              style={{ background: e.category ? categoryColor(e.category) : 'var(--label-3)' }}
                            >
                              <Icon size={16} strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">{e.merchant || categoryLabel(e.category ?? 'other')}</span>
                              <span className="flex items-center gap-1.5 truncate text-[12.5px] text-muted-foreground">
                                <Source size={12} strokeWidth={2} aria-label={SOURCE_META[e.source].label} />
                                {e.category ? categoryLabel(e.category) : 'To sort'}
                                {unplanned && e.category && ' · unplanned'}
                              </span>
                            </span>
                            <span className={`tnum shrink-0 text-[15px] font-semibold ${e.amount < 0 ? 'text-primary' : ''}`}>
                              {e.amount < 0 ? `+${formatCurrencyExact(Math.abs(e.amount))}` : formatCurrencyExact(e.amount)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function EditSpendSheet({
  entry,
  onClose,
  ref,
}: {
  entry: SpendEntry
  onClose: () => void
  ref: Ref<HTMLElement>
}) {
  const update = useUpdateSpend()
  const remove = useDeleteSpend()
  const restore = useRestoreSpend()
  const [amount, setAmount] = useState(String(Math.abs(entry.amount)))
  const [refund, setRefund] = useState(entry.amount < 0)
  const [merchant, setMerchant] = useState(entry.merchant ?? '')
  const [category, setCategory] = useState(entry.category ?? '')
  const [day, setDay] = useState(dateKey(new Date(entry.spent_at)))

  const value = Math.round(Number(amount.replace(',', '.')) * 100) / 100

  function save(e: FormEvent) {
    e.preventDefault()
    if (!(value > 0)) return toast.error('Enter an amount above zero.')
    if (!category) return toast.error('Choose a category.')
    const original = new Date(entry.spent_at)
    const [y, m, d] = day.split('-').map(Number)
    const spentAt = new Date(y, m - 1, d, original.getHours(), original.getMinutes()).toISOString()
    update.mutate(
      {
        id: entry.id,
        patch: { amount: refund ? -value : value, merchant: merchant.trim() || null, category, spent_at: spentAt },
      },
      {
        onSuccess: () => {
          toast.success('Spend updated')
          onClose()
        },
      },
    )
  }

  function del() {
    remove.mutate(
      { id: entry.id },
      {
        onSuccess: () => {
          onClose()
          toast('Spend removed', { action: { label: 'Undo', onClick: () => restore.mutate(entry.id) } })
        },
      },
    )
  }

  return (
    <InlineSheet ref={ref} title={entry.category ? 'Edit spend' : 'Sort this spend'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="edit-amount">
              Amount
            </label>
            <input id="edit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-date">
              Date
            </label>
            <input id="edit-date" type="date" value={day} max={dateKey(new Date())} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-merchant">
              Where or what
            </label>
            <input id="edit-merchant" value={merchant} maxLength={120} onChange={(e) => setMerchant(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-category">
              Category
            </label>
            <Select
              id="edit-category"
              value={category}
              placeholder="Choose a category"
              onValueChange={setCategory}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            />
          </div>
        </div>
        <Segmented
          label="Money out or money back"
          value={refund ? 'in' : 'out'}
          onChange={(v) => setRefund(v === 'in')}
          options={[
            { value: 'out', label: 'Money out' },
            { value: 'in', label: 'Money back' },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={del} disabled={remove.isPending} className="btn btn-ghost text-alert">
            <Trash2 size={15} strokeWidth={2} /> Delete
          </button>
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={update.isPending} className="btn btn-primary">
              {update.isPending && <Loader2 size={16} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </form>
    </InlineSheet>
  )
}

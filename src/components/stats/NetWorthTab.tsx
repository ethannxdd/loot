import { Pencil, Plus, Scale, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NetWorthItemForm } from '@/components/networth/NetWorthItemForm'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { StatStrip } from '@/components/ui/StatStrip'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import {
  useCreateNetWorthItem,
  useDeleteNetWorthItem,
  useNetWorthItems,
  useUpdateNetWorthItem,
} from '@/hooks/useNetWorthItems'
import { computeNetWorthTotals } from '@/lib/net-worth'
import { monthLabel } from '@/lib/money'
import { NET_WORTH_CATEGORY_LABELS, type MonthlySnapshot, type NetWorthItem } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export function NetWorthTab({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const { data: items = [], isLoading } = useNetWorthItems()
  const createItem = useCreateNetWorthItem()
  const updateItem = useUpdateNetWorthItem()
  const deleteItem = useDeleteNetWorthItem()
  const [modal, setModal] = useState<'new' | NetWorthItem | null>(null)
  const [toDelete, setToDelete] = useState<NetWorthItem | null>(null)
  const formRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (modal) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [modal])

  const totals = computeNetWorthTotals(items)
  const assets = items.filter((i) => i.kind === 'asset')
  const liabilities = items.filter((i) => i.kind === 'liability')

  const chartData = snapshots
    .filter((s) => s.net_worth !== null)
    .map((s) => ({ month: monthLabel(s.month), netWorth: Math.round(s.net_worth ?? 0) }))

  if (isLoading) return <div className="skeleton h-64 rounded-2xl" />

  return (
    <div className="space-y-5">
      <StatStrip
        items={[
          { label: 'Own', color: 'var(--chart-1)', value: formatCurrency(totals.assetsTotal), sub: `${assets.length} asset${assets.length === 1 ? '' : 's'}` },
          { label: 'Owe', color: 'var(--chart-5)', value: formatCurrency(totals.liabilitiesTotal), sub: `${liabilities.length} debt${liabilities.length === 1 ? '' : 's'}` },
          {
            label: 'Net worth',
            value: formatCurrency(totals.netWorth),
            valueColor: totals.netWorth < 0 ? 'var(--alert)' : 'var(--accent)',
            sub: 'What you own minus what you owe',
          },
        ]}
      />

      {chartData.length < 2 && items.length > 0 && (
        <p className="px-1 text-[13px] text-muted-foreground">
          Your net worth is saved with each month&apos;s snapshot — the trend chart appears once two months have data.
        </p>
      )}

      {chartData.length >= 2 && (
        <div className="card sm:p-6">
          <h3 className="card-title mb-4">Net worth over time</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={0} />
                <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="netWorth" name="Net worth" stroke="var(--accent)" strokeWidth={2.5} fill="url(#nwFill)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {modal && (
        <InlineSheet ref={formRef} title={modal === 'new' ? 'Add to net worth' : `Edit ${modal.label}`} onClose={() => setModal(null)}>
          <NetWorthItemForm
            key={modal === 'new' ? 'new' : modal.id}
            initial={modal === 'new' ? undefined : modal}
            isSubmitting={createItem.isPending || updateItem.isPending}
            onCancel={() => setModal(null)}
            onSubmit={(values) => {
              if (modal === 'new') {
                createItem.mutate(values, {
                  onSuccess: () => {
                    setModal(null)
                    toast.success(`${values.label} added`)
                  },
                })
              } else {
                updateItem.mutate(
                  { id: modal.id, patch: values },
                  {
                    onSuccess: () => {
                      setModal(null)
                      toast.success('Item updated')
                    },
                  },
                )
              }
            }}
          />
        </InlineSheet>
      )}

      {items.length === 0 && !isLoading && !modal ? (
        <div className="card-elevated flex flex-col items-center gap-4 py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
            <Scale size={28} strokeWidth={1.8} />
          </span>
          <p className="max-w-sm text-[14px] text-muted-foreground">
            Add what you own and owe to start tracking your net worth over time.
          </p>
          <button type="button" onClick={() => setModal('new')} className="btn btn-primary">
            <Plus size={16} strokeWidth={2.4} /> Add asset or debt
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(
            [
              { title: 'What you own', list: assets, color: 'var(--chart-1)' },
              { title: 'What you owe', list: liabilities, color: 'var(--chart-5)' },
            ] as const
          ).map(({ title, list, color }) => (
            <section key={title}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="card-title">{title}</h3>
                <span className="tnum text-[13px] font-semibold text-muted-foreground">
                  {formatCurrency(list.reduce((s, i) => s + i.value, 0))}
                </span>
              </div>
              <div className="card !px-4 !py-2">
                {list.length === 0 && <p className="py-4 text-center text-[13px] text-muted-foreground">Nothing added yet.</p>}
                <div className="divide-y divide-hairline">
                  {list.map((item) => (
                    <div key={item.id} className="group flex items-center gap-3 py-3">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold text-white"
                        style={{ background: color }}
                      >
                        {item.label.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{item.label}</p>
                        <p className="text-[12.5px] text-muted-foreground">{NET_WORTH_CATEGORY_LABELS[item.category]}</p>
                      </div>
                      <span className="tnum text-[15px] font-semibold">{formatCurrency(item.value)}</span>
                      <div className="flex transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                        <button type="button" onClick={() => setModal(item)} aria-label={`Edit ${item.label}`} className="grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-foreground">
                          <Pencil size={14} strokeWidth={1.9} />
                        </button>
                        <button type="button" onClick={() => setToDelete(item)} aria-label={`Delete ${item.label}`} className="grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert">
                          <Trash2 size={14} strokeWidth={1.9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {modal === null && items.length > 0 && (
        <button type="button" onClick={() => setModal('new')} className="btn btn-secondary">
          <Plus size={16} strokeWidth={2.4} /> Add asset or debt
        </button>
      )}

      {toDelete && (
        <ConfirmModal
          title={`Delete ${toDelete.label}?`}
          confirmLabel="Delete"
          isPending={deleteItem.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() =>
            deleteItem.mutate(toDelete.id, {
              onSuccess: () => {
                setToDelete(null)
                toast.success(`${toDelete.label} deleted`)
              },
            })
          }
        >
          <p>It will be removed from your net worth. This can't be undone.</p>
        </ConfirmModal>
      )}

    </div>
  )
}

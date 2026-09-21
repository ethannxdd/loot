import { Pencil, Plus, Scale, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NetWorthItemForm } from '@/components/networth/NetWorthItemForm'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
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

  const totals = computeNetWorthTotals(items)
  const assets = items.filter((i) => i.kind === 'asset')
  const liabilities = items.filter((i) => i.kind === 'liability')

  const chartData = snapshots
    .filter((s) => s.net_worth !== null)
    .map((s) => ({ month: monthLabel(s.month), netWorth: Math.round(s.net_worth ?? 0) }))

  if (isLoading) return <div className="skeleton h-64 rounded-2xl" />

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="overline">Assets</p>
          <p className="tnum text-lg text-primary">{formatCurrency(totals.assetsTotal)}</p>
        </div>
        <div className="card">
          <p className="overline">Liabilities</p>
          <p className="tnum text-lg text-alert">{formatCurrency(totals.liabilitiesTotal)}</p>
        </div>
        <div className="card">
          <p className="overline">Net worth</p>
          <p className={`tnum text-lg ${totals.netWorth < 0 ? 'text-alert' : ''}`}>{formatCurrency(totals.netWorth)}</p>
        </div>
      </div>

      {chartData.length < 2 && items.length > 0 && (
        <p className="px-1 text-xs text-text-muted">
          Your net worth is saved with each month's snapshot — the trend chart appears once two months have data.
        </p>
      )}

      {chartData.length >= 2 && (
        <div className="card">
          <p className="overline mb-3">Net worth over time</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} width={0} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                  contentStyle={{ background: '#211B1B', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="netWorth" stroke="#C1FE72" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {(
          [
            { title: 'Assets', list: assets },
            { title: 'Liabilities', list: liabilities },
          ] as const
        ).map(({ title, list }) => (
          <div key={title} className="card space-y-2">
            <p className="overline">{title}</p>
            {list.length === 0 && <p className="py-4 text-center text-xs text-text-muted">Nothing added yet.</p>}
            {list.map((item) => (
              <div key={item.id} className="group flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{NET_WORTH_CATEGORY_LABELS[item.category]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-sm">{formatCurrency(item.value)}</span>
                  <div className="flex transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <button type="button" onClick={() => setModal(item)} aria-label={`Edit ${item.label}`} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-foreground">
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                    <button type="button" onClick={() => setToDelete(item)} aria-label={`Delete ${item.label}`} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert">
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setModal('new')}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        <Plus size={14} strokeWidth={2} /> Add asset or liability
      </button>

      {items.length === 0 && !isLoading && (
        <div className="card-elevated flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
            <Scale size={24} strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">Add what you own and owe to start tracking your net worth over time.</p>
        </div>
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

      {modal && (
        <Modal title={modal === 'new' ? 'Add item' : 'Edit item'} onClose={() => setModal(null)}>
          <NetWorthItemForm
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
        </Modal>
      )}
    </div>
  )
}

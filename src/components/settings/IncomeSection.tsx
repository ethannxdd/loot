import { Check, Loader2, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  useAddIncomeStream,
  useDeleteIncomeStream,
  useIncomeStreams,
  useUpdateIncomeStream,
} from '@/hooks/useIncomeStreams'
import { useUpdateProfile } from '@/hooks/useProfile'
import { monthlyIncomeAmount } from '@/lib/money'
import type { IncomeFrequency, IncomeStream, Profile } from '@/lib/types'
import { formatCurrencyExact } from '@/lib/utils'

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Every two weeks',
  weekly: 'Weekly',
  yearly: 'Yearly',
}

/** Monthly gross/net income (the numbers every calculation in Loot uses) plus the streams that make it up. */
export function IncomeSection({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const { data: streams = [] } = useIncomeStreams()
  const addStream = useAddIncomeStream()
  const updateStream = useUpdateIncomeStream()
  const deleteStream = useDeleteIncomeStream()

  const [gross, setGross] = useState(String(profile.gross_income))
  const [net, setNet] = useState(String(profile.net_income))
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [sName, setSName] = useState('')
  const [sGross, setSGross] = useState('')
  const [sNet, setSNet] = useState('')
  const [sFreq, setSFreq] = useState<IncomeFrequency>('monthly')
  const [confirmDelete, setConfirmDelete] = useState<IncomeStream | null>(null)

  const grossNum = Number(gross)
  const netNum = Number(net)
  const validNumbers = Number.isFinite(grossNum) && Number.isFinite(netNum) && grossNum >= 0 && netNum >= 0
  const dirty = grossNum !== profile.gross_income || netNum !== profile.net_income

  const activeStreams = streams.filter((s) => s.is_active)
  const streamNet = activeStreams.reduce((sum, s) => sum + monthlyIncomeAmount(s.net_amount, s.frequency), 0)
  const streamGross = activeStreams.reduce((sum, s) => sum + monthlyIncomeAmount(s.gross_amount, s.frequency), 0)
  const streamsDifferFromTotals =
    activeStreams.length > 0 && (Math.round(streamNet) !== Math.round(profile.net_income) || Math.round(streamGross) !== Math.round(profile.gross_income))

  function saveTotals(e: FormEvent) {
    e.preventDefault()
    if (!validNumbers) return toast.error('Enter income amounts of zero or more.')
    update.mutate(
      { gross_income: grossNum, net_income: netNum },
      { onSuccess: () => toast.success('Income saved') },
    )
  }

  function applyStreamTotals() {
    const g = Math.round(streamGross * 100) / 100
    const n = Math.round(streamNet * 100) / 100
    update.mutate(
      { gross_income: g, net_income: n },
      {
        onSuccess: () => {
          setGross(String(g))
          setNet(String(n))
          toast.success('Income updated from your streams')
        },
      },
    )
  }

  function openForm(stream?: IncomeStream) {
    setEditing(stream ? stream.id : 'new')
    setSName(stream?.name ?? '')
    setSGross(stream ? String(stream.gross_amount) : '')
    setSNet(stream ? String(stream.net_amount) : '')
    setSFreq(stream?.frequency ?? 'monthly')
  }

  function closeForm() {
    setEditing(null)
  }

  function submitStream(e: FormEvent) {
    e.preventDefault()
    const g = Number(sGross || 0)
    const n = Number(sNet || 0)
    if (!sName.trim()) return toast.error('Give the income stream a name.')
    if (!(n > 0 || g > 0)) return toast.error('Enter a net or gross amount.')
    if (g < 0 || n < 0) return toast.error('Amounts can’t be negative.')
    const values = { name: sName.trim(), gross_amount: g, net_amount: n, frequency: sFreq }
    if (editing === 'new') {
      addStream.mutate(values, { onSuccess: () => { closeForm(); toast.success('Income stream added') } })
    } else if (editing) {
      updateStream.mutate({ id: editing, patch: values }, { onSuccess: () => { closeForm(); toast.success('Income stream updated') } })
    }
  }

  return (
    <>
      <form onSubmit={saveTotals} className="card space-y-4">
        <div className="overline flex items-center gap-1.5">
          <Wallet size={13} strokeWidth={2} /> Monthly income
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="settings-gross">
              Gross (before tax)
            </label>
            <input id="settings-gross" type="number" inputMode="decimal" min={0} step="any" value={gross} onChange={(e) => setGross(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="settings-net">
              Net (take-home)
            </label>
            <input id="settings-net" type="number" inputMode="decimal" min={0} step="any" value={net} onChange={(e) => setNet(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-text-muted">
          These monthly figures drive your available loot, savings rate, affordability checks, forecast and tax estimate.
        </p>
        {validNumbers && netNum > grossNum && grossNum > 0 && (
          <p className="text-xs text-caution">Your take-home is higher than your gross income — double-check the two numbers.</p>
        )}
        <button type="submit" disabled={!dirty || !validNumbers || update.isPending} className="btn btn-primary w-full sm:w-auto">
          {update.isPending && <Loader2 size={16} className="animate-spin" />}
          Save income
        </button>
      </form>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="overline">Income streams</div>
          {editing === null && (
            <button type="button" onClick={() => openForm()} className="btn btn-ghost !h-8 !px-3 !text-xs">
              <Plus size={14} strokeWidth={2} /> Add stream
            </button>
          )}
        </div>

        {streams.length === 0 && editing === null && (
          <p className="text-sm text-muted-foreground">
            Have a salary plus freelance work, or a side hustle? Add each stream here and Loot will total them for you.
          </p>
        )}

        {streams.length > 0 && (
          <ul className="space-y-1">
            {streams.map((stream) => (
              <li
                key={stream.id}
                className={`group flex items-center gap-3 rounded-[10px] px-2 py-2.5 ${stream.is_active ? '' : 'opacity-50'}`}
              >
                <button
                  type="button"
                  onClick={() => updateStream.mutate({ id: stream.id, patch: { is_active: !stream.is_active } })}
                  aria-label={stream.is_active ? `Pause ${stream.name}` : `Resume ${stream.name}`}
                  title={stream.is_active ? 'Active — click to pause' : 'Paused — click to resume'}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    stream.is_active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  }`}
                >
                  {stream.is_active && <Check size={12} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{stream.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {FREQUENCY_LABELS[stream.frequency]} · gross {formatCurrencyExact(stream.gross_amount)}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm">{formatCurrencyExact(stream.net_amount)}</span>
                <div className="flex shrink-0 gap-1 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openForm(stream)}
                    aria-label={`Edit ${stream.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(stream)}
                    aria-label={`Delete ${stream.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-alert"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {activeStreams.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-white/[0.03] p-3.5">
            <p className="text-xs text-muted-foreground">
              Active streams add up to <span className="tnum font-semibold text-foreground">{formatCurrencyExact(streamNet)}</span> net /{' '}
              <span className="tnum font-semibold text-foreground">{formatCurrencyExact(streamGross)}</span> gross a month.
            </p>
            {streamsDifferFromTotals && (
              <button type="button" onClick={applyStreamTotals} disabled={update.isPending} className="btn btn-secondary !h-8 !px-3 !text-xs">
                Use these as my income
              </button>
            )}
          </div>
        )}

        {editing !== null && (
          <form onSubmit={submitStream} className="space-y-3 rounded-xl border border-border bg-white/[0.03] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="stream-name">
                  Name
                </label>
                <input id="stream-name" value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Salary, freelance…" autoFocus required />
              </div>
              <div>
                <label className="field-label" htmlFor="stream-gross">
                  Gross
                </label>
                <input id="stream-gross" type="number" inputMode="decimal" min={0} step="any" value={sGross} onChange={(e) => setSGross(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="stream-net">
                  Net
                </label>
                <input id="stream-net" type="number" inputMode="decimal" min={0} step="any" value={sNet} onChange={(e) => setSNet(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="stream-frequency">
                  How often
                </label>
                <select id="stream-frequency" value={sFreq} onChange={(e) => setSFreq(e.target.value as IncomeFrequency)}>
                  {(Object.keys(FREQUENCY_LABELS) as IncomeFrequency[]).map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeForm} className="btn btn-ghost flex-1">
                <X size={14} strokeWidth={2} /> Cancel
              </button>
              <button type="submit" disabled={addStream.isPending || updateStream.isPending} className="btn btn-primary flex-1">
                {(addStream.isPending || updateStream.isPending) && <Loader2 size={16} className="animate-spin" />}
                {editing === 'new' ? 'Add stream' : 'Save stream'}
              </button>
            </div>
          </form>
        )}
      </section>

      {confirmDelete && (
        <ConfirmModal
          title="Delete income stream?"
          confirmLabel="Delete"
          isPending={deleteStream.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            deleteStream.mutate(confirmDelete.id, {
              onSuccess: () => {
                setConfirmDelete(null)
                toast.success('Income stream deleted')
              },
            })
          }
        >
          <p>
            <span className="font-semibold text-foreground">{confirmDelete.name}</span> will be removed. Your monthly income
            total above won’t change unless you update it.
          </p>
        </ConfirmModal>
      )}
    </>
  )
}

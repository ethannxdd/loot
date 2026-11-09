import { Loader2, Plus, Send, Split as SplitIcon, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type Ref } from 'react'
import { toast } from 'sonner'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { SwitchRow } from '@/components/ui/Switch'
import { useCreateSplit, useDeleteSplit, useRestoreSplit, useSettleShare, useSplits } from '@/hooks/usePeople'
import { useProfile } from '@/hooks/useProfile'
import { useSpendEntries } from '@/hooks/useSpendEntries'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/categories'
import { dateKey } from '@/lib/sa-calendar'
import {
  amountsMismatch,
  balances,
  isSettled,
  knownPeople,
  outstanding,
  requestMessage,
  settle,
  splitAmounts,
  type Split,
  type SplitMode,
  type SplitShare,
} from '@/lib/splits'
import { formatCurrencyExact } from '@/lib/utils'

type View = 'open' | 'settled' | 'people'

/** /splits (§4.2): shared bills, who owes whom, settle and send a request. */
export function SplitsPage() {
  const { data, isLoading } = useSplits()
  const { data: profile } = useProfile()
  const [view, setView] = useState<View>('open')
  const [creating, setCreating] = useState(false)
  const formRef = useRef<HTMLElement>(null)
  const splits = data?.splits ?? []
  const shares = data?.shares ?? []
  const b = balances(splits, shares)
  const open = splits.filter((s) => !isSettled(s, shares))
  const settled = splits.filter((s) => isSettled(s, shares))
  const list = view === 'open' ? open : settled

  function start() {
    setCreating(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="People"
        title="Splits"
        subtitle="Shared bills and who still owes whom. It only counts in Safe to spend once it’s settled."
        actions={
          <button type="button" onClick={start} className="btn btn-primary">
            <Plus size={16} strokeWidth={2.4} /> Split a bill
          </button>
        }
      />

      <StatStrip
        items={[
          { label: 'Owed to you', value: formatCurrencyExact(b.owedToMe), valueColor: b.owedToMe > 0 ? 'var(--accent)' : undefined },
          { label: 'You owe', value: formatCurrencyExact(b.iOwe), valueColor: b.iOwe > 0 ? 'var(--caution)' : undefined },
          { label: 'Open splits', value: String(open.length) },
        ]}
      />

      {creating && <CreateSplitSheet ref={formRef} shares={shares} onClose={() => setCreating(false)} />}

      <Segmented
        label="Splits view"
        value={view}
        onChange={setView}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'settled', label: 'Settled' },
          { value: 'people', label: 'People' },
        ]}
      />

      {isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : view === 'people' ? (
        b.people.length === 0 ? (
          <Empty onStart={start} text="Nobody owes anybody. Nice." />
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
            {b.people.map((p, i) => (
              <li key={p.person} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                <div>
                  <p className="text-[15px] font-semibold">{p.person}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    across {new Set(p.splitIds).size} split{new Set(p.splitIds).size === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right text-[14px]">
                  {p.owesMe > 0 && <p className="tnum font-semibold text-primary">owes you {formatCurrencyExact(p.owesMe)}</p>}
                  {p.iOwe > 0 && <p className="tnum font-semibold text-caution">you owe {formatCurrencyExact(p.iOwe)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <Empty onStart={start} text={view === 'open' ? 'No open splits. Split a bill to track who owes what.' : 'Nothing settled yet.'} />
      ) : (
        <div className="space-y-4">
          {list.map((s) => (
            <SplitCard key={s.id} split={s} shares={shares.filter((x) => x.split_id === s.id)} shapId={profile?.payshap_id ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}

function Empty({ onStart, text }: { onStart: () => void; text: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-tint)] text-primary">
        <SplitIcon size={26} strokeWidth={1.8} />
      </span>
      <p className="max-w-sm text-[14px] text-muted-foreground">{text}</p>
      <button type="button" onClick={onStart} className="btn btn-primary mt-1">
        <Plus size={16} strokeWidth={2.4} /> Split a bill
      </button>
    </div>
  )
}

function SplitCard({ split, shares, shapId }: { split: Split; shares: SplitShare[]; shapId: string | null }) {
  const settleShare = useSettleShare()
  const { data: entries = [] } = useSpendEntries()
  const remove = useDeleteSplit()
  const restore = useRestoreSplit()
  const [settling, setSettling] = useState<SplitShare | null>(null)
  const [part, setPart] = useState('')
  const myShare = shares.find((s) => s.is_me)
  const others = shares.filter((s) => !s.is_me)

  async function sendRequest(share: SplitShare) {
    const text = requestMessage(share.person_name, split.title, formatCurrencyExact(outstanding(share)), shapId)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast.success('Request copied — paste it in WhatsApp or SMS')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        await navigator.clipboard.writeText(text).catch(() => undefined)
        toast.success('Request copied')
      }
    }
  }

  function doSettle(share: SplitShare, amount: number) {
    const r = settle(share, amount)
    settleShare.mutate(
      {
        split,
        share,
        ...r,
        // Money back nets against the original spend's category; if the bill was never logged, nothing is logged now
        // either. Settling my share of someone else's bill logs it as a spend.
        category: split.paid_by === 'me' ? (entries.find((e) => e.id === split.spend_entry_id)?.category ?? null) : 'other',
      },
      {
        onSuccess: () => {
          setSettling(null)
          setPart('')
          toast.success(r.settled_at ? `${share.is_me ? 'Paid' : share.person_name + ' paid'} in full` : `Recorded ${formatCurrencyExact(r.applied)}`)
        },
      },
    )
  }

  return (
    <section className="card space-y-3" data-testid="split-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{split.title}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {new Date(`${split.spent_on}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} ·{' '}
            {split.paid_by === 'me' ? 'You paid' : `${split.payer_name ?? 'Someone'} paid`} · your share{' '}
            {myShare ? formatCurrencyExact(myShare.amount) : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum text-[16px] font-bold">{formatCurrencyExact(split.total)}</span>
          <button
            type="button"
            aria-label={`Delete ${split.title}`}
            onClick={() =>
              remove.mutate(split.id, { onSuccess: () => toast('Split removed', { action: { label: 'Undo', onClick: () => restore.mutate(split.id) } }) })
            }
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-fill hover:text-alert"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <ul className="divide-y divide-hairline rounded-2xl bg-fill">
        {(split.paid_by === 'me' ? others : myShare ? [myShare] : []).map((sh) => {
          const left = outstanding(sh)
          return (
            <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium">{sh.is_me ? `You owe ${split.payer_name ?? 'them'}` : sh.person_name}</p>
                <p className="tnum text-[12.5px] text-muted-foreground">
                  {left > 0 ? `${formatCurrencyExact(left)} open` : 'Settled'}
                  {sh.settled_amount > 0 && left > 0 && ` · ${formatCurrencyExact(sh.settled_amount)} paid`}
                </p>
              </div>
              {left > 0 && (
                <div className="flex gap-2">
                  {!sh.is_me && (
                    <button type="button" onClick={() => void sendRequest(sh)} className="btn btn-secondary !min-h-9 !px-3 !text-[13px]">
                      <Send size={13} /> Request
                    </button>
                  )}
                  <button type="button" onClick={() => setSettling(sh)} className="btn btn-primary !min-h-9 !px-3 !text-[13px]">
                    Paid
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {settling && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-[var(--accent-tint)] p-3">
          <button type="button" disabled={settleShare.isPending} onClick={() => doSettle(settling, outstanding(settling))} className="btn btn-primary !min-h-10">
            {settleShare.isPending && <Loader2 size={14} className="animate-spin" />}
            Full {formatCurrencyExact(outstanding(settling))}
          </button>
          <div className="flex items-end gap-2">
            <input className="!w-28" inputMode="decimal" placeholder="Part" aria-label="Part payment" value={part} onChange={(e) => setPart(e.target.value)} />
            <button type="button" disabled={!(Number(part) > 0) || settleShare.isPending} onClick={() => doSettle(settling, Number(part))} className="btn btn-secondary !min-h-10">
              Record part
            </button>
          </div>
          <button type="button" onClick={() => setSettling(null)} aria-label="Cancel" className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-surface">
            <X size={15} />
          </button>
        </div>
      )}
    </section>
  )
}

interface PersonRow {
  key: string
  name: string
  value: string
}

function CreateSplitSheet({ shares, onClose, ref }: { shares: SplitShare[]; onClose: () => void; ref: Ref<HTMLElement> }) {
  const create = useCreateSplit()
  const [title, setTitle] = useState('')
  const [total, setTotal] = useState('')
  const [day, setDay] = useState(dateKey(new Date()))
  const [paidBy, setPaidBy] = useState<'me' | 'other'>('me')
  const [payer, setPayer] = useState('')
  const [mode, setMode] = useState<SplitMode>('equal')
  const [people, setPeople] = useState<PersonRow[]>([{ key: 'me', name: 'You', value: '1' }])
  const [newPerson, setNewPerson] = useState('')
  const [logIt, setLogIt] = useState(true)
  const [category, setCategory] = useState('eating_out')
  const suggestions = knownPeople(shares).filter((n) => !people.some((p) => p.name.toLowerCase() === n.toLowerCase())).slice(0, 6)

  const totalNum = Number(total) || 0
  const amounts = useMemo(
    () => splitAmounts(totalNum, mode, people.map((p) => (mode === 'equal' ? 1 : Number(p.value) || 0))),
    [totalNum, mode, people],
  )
  const mismatch = mode === 'amounts' ? amountsMismatch(totalNum, amounts) : 0

  function addPerson(name: string) {
    const n = name.trim()
    if (!n || people.some((p) => p.name.toLowerCase() === n.toLowerCase())) return
    setPeople((list) => [...list, { key: `${n}-${list.length}`, name: n, value: mode === 'amounts' ? '' : '1' }])
    setNewPerson('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast.error('What was it for?')
    if (!(totalNum > 0)) return toast.error('Enter the total.')
    if (people.length < 2) return toast.error('Add at least one other person.')
    if (paidBy === 'other' && !payer.trim()) return toast.error('Who paid?')
    if (mode === 'amounts' && Math.abs(mismatch) >= 0.01) return toast.error(`The amounts are ${formatCurrencyExact(Math.abs(mismatch))} ${mismatch > 0 ? 'short of' : 'over'} the total.`)
    create.mutate(
      {
        split: { title: title.trim(), total: totalNum, spent_on: day, paid_by: paidBy, payer_name: paidBy === 'other' ? payer.trim() : null, split_mode: mode, note: null },
        shares: people.map((p, i) => ({ person_name: p.key === 'me' ? 'You' : p.name, is_me: p.key === 'me', amount: amounts[i] })),
        logSpend: paidBy === 'me' && logIt ? { category } : null,
      },
      {
        onSuccess: () => {
          toast.success('Split saved')
          onClose()
        },
      },
    )
  }

  return (
    <InlineSheet ref={ref} title="Split a bill" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="field-label" htmlFor="sp-title">
              What for
            </label>
            <input id="sp-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Airbnb in Durban" autoFocus />
          </div>
          <div>
            <label className="field-label" htmlFor="sp-total">
              Total
            </label>
            <input id="sp-total" type="number" inputMode="decimal" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="sp-date">
              Date
            </label>
            <input id="sp-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <span className="field-label">Who paid</span>
            <Segmented
              full
              label="Who paid"
              value={paidBy}
              onChange={setPaidBy}
              options={[
                { value: 'me', label: 'I paid' },
                { value: 'other', label: 'Someone else' },
              ]}
            />
          </div>
          {paidBy === 'other' && (
            <div className="sm:col-span-3">
              <label className="field-label" htmlFor="sp-payer">
                Who paid
              </label>
              <input id="sp-payer" value={payer} maxLength={60} onChange={(e) => setPayer(e.target.value)} placeholder="Naledi" />
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-2xl bg-fill p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="field-label !mb-0">People</span>
            <Segmented
              size="sm"
              label="How to split"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'equal', label: 'Equal' },
                { value: 'amounts', label: 'Amounts' },
                { value: 'shares', label: 'Shares' },
              ]}
            />
          </div>
          <ul className="divide-y divide-hairline rounded-xl bg-surface">
            {people.map((p, i) => (
              <li key={p.key} className="flex items-center gap-2 px-3 py-2">
                <span className={`flex-1 truncate text-[14.5px] ${p.key === 'me' ? 'font-semibold' : ''}`}>{p.name}</span>
                {mode !== 'equal' && (
                  <input
                    className="!w-24"
                    inputMode="decimal"
                    aria-label={`${p.name} ${mode === 'amounts' ? 'amount' : 'shares'}`}
                    value={p.value}
                    onChange={(e) => setPeople((l) => l.map((x) => (x.key === p.key ? { ...x, value: e.target.value } : x)))}
                  />
                )}
                <span className="tnum w-24 text-right text-[14px] font-semibold">{formatCurrencyExact(amounts[i] ?? 0)}</span>
                {p.key !== 'me' && (
                  <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPeople((l) => l.filter((x) => x.key !== p.key))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-fill">
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newPerson}
              maxLength={60}
              onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPerson(newPerson)
                }
              }}
              placeholder="Add a name"
              aria-label="Add a person"
            />
            <button type="button" onClick={() => addPerson(newPerson)} className="btn btn-secondary shrink-0">
              Add
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((n) => (
                <button key={n} type="button" onClick={() => addPerson(n)} className="chip chip-neutral hover:bg-fill-2">
                  + {n}
                </button>
              ))}
            </div>
          )}
          {mode === 'amounts' && Math.abs(mismatch) >= 0.01 && (
            <p className="text-[13px] font-medium text-caution">
              {formatCurrencyExact(Math.abs(mismatch))} {mismatch > 0 ? 'still to assign' : 'more than the total'}
            </p>
          )}
        </div>

        {paidBy === 'me' && (
          <div className="space-y-2">
            <SwitchRow checked={logIt} onChange={setLogIt} label={`Log the full ${totalNum > 0 ? formatCurrencyExact(totalNum) : 'amount'} as a spend`} hint="When friends pay you back, it comes off again." />
            {logIt && (
              <Select aria-label="Category" value={category} onValueChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className="btn btn-primary flex-[2]">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            Save split
          </button>
        </div>
      </form>
    </InlineSheet>
  )
}

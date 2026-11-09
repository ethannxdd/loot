import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, ChevronUp, HandCoins, Loader2, Plus, X } from 'lucide-react'
import { useRef, useState, type FormEvent, type Ref } from 'react'
import { toast } from 'sonner'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { SwitchRow } from '@/components/ui/Switch'
import { useCreateStokvel, useStokvels } from '@/hooks/usePeople'
import {
  currentMonth,
  monthName,
  monthlyContribution,
  nextContributionDate,
  paidInSoFar,
  payoutFor,
  STOKVEL_TYPE_LABELS,
  STOKVEL_TYPES,
  type Stokvel,
  type StokvelFrequency,
  type StokvelType,
} from '@/lib/stokvel'
import { formatCurrency } from '@/lib/utils'

/** /stokvels (§4.1): your stokvels, and the create form. */
export function StokvelsPage() {
  const { data, isLoading } = useStokvels()
  const [creating, setCreating] = useState(false)
  const formRef = useRef<HTMLElement>(null)
  const stokvels = (data?.stokvels ?? []).filter((s) => !s.ended_at)
  const monthly = stokvels.reduce((sum, s) => sum + monthlyContribution(s), 0)
  const upcoming = stokvels
    .map((s) => ({ s, p: payoutFor(s) }))
    .filter((x) => x.p && x.p.month >= currentMonth())
    .sort((a, b) => a.p!.month.localeCompare(b.p!.month))[0]

  function open() {
    setCreating(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="People"
        title="Stokvels"
        subtitle="Track your contributions and know when your payout lands. Members are names only."
        actions={
          <button type="button" onClick={open} className="btn btn-primary" data-tutorial="stokvels-add">
            <Plus size={16} strokeWidth={2.4} /> Add a stokvel
          </button>
        }
      />

      {stokvels.length > 0 && (
        <StatStrip
          items={[
            { label: 'Stokvels', value: String(stokvels.length) },
            { label: 'Paying in', value: formatCurrency(monthly), sub: 'a month' },
            {
              label: 'Next payout',
              value: upcoming ? formatCurrency(upcoming.p!.amount) : '—',
              sub: upcoming ? `${upcoming.s.name} · ${monthName(upcoming.p!.month)}` : undefined,
            },
          ]}
        />
      )}

      {creating && <CreateStokvelSheet ref={formRef} onClose={() => setCreating(false)} />}

      {isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : stokvels.length === 0 && !creating ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-tint)] text-primary">
            <HandCoins size={26} strokeWidth={1.8} />
          </span>
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">No stokvels yet</h2>
          <p className="max-w-sm text-[14px] text-muted-foreground">
            Add your stokvel to see your monthly contribution in your budget and your payout on the way.
          </p>
          <button type="button" onClick={open} className="btn btn-primary mt-1">
            <Plus size={16} strokeWidth={2.4} /> Add a stokvel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stokvels.map((s) => (
            <StokvelCard key={s.id} s={s} paidIn={paidInSoFar((data?.payments ?? []).filter((p) => p.stokvel_id === s.id))} />
          ))}
        </div>
      )}
    </div>
  )
}

function StokvelCard({ s, paidIn }: { s: Stokvel; paidIn: number }) {
  const payout = payoutFor(s)
  const next = nextContributionDate(s)
  const isFuture = payout && payout.month >= currentMonth()
  return (
    <Link to="/stokvels/$stokvelId" params={{ stokvelId: s.id }} className="card card-hover flex flex-col gap-3" data-testid="stokvel-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{s.name}</p>
          <p className="tnum text-[13px] text-muted-foreground">
            {formatCurrency(Number(s.contribution_amount))} {s.frequency === 'monthly' ? 'a month' : s.frequency === 'weekly' ? 'a week' : 'a fortnight'}
            {next && ` · next ${next.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>
        <span className="chip chip-neutral shrink-0">{STOKVEL_TYPE_LABELS[s.type]}</span>
      </div>
      <div className="flex items-end justify-between gap-3 rounded-2xl bg-fill px-3.5 py-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">{s.type === 'rotating' ? 'Your turn' : payout ? 'Payout' : 'Paid in so far'}</p>
          <p className="tnum text-[17px] font-bold">
            {payout ? `${payout.estimate ? '~' : ''}${formatCurrency(payout.amount)}` : formatCurrency(paidIn)}
          </p>
        </div>
        <div className="text-right text-[13px] text-muted-foreground">
          {payout ? (isFuture ? monthName(payout.month) : `Paid out ${monthName(payout.month)}`) : 'No set payout'}
          <ChevronRight size={16} className="ml-1 inline text-text-subtle" />
        </div>
      </div>
    </Link>
  )
}

const FREQ_LABELS: Record<StokvelFrequency, string> = { monthly: 'Monthly', fortnightly: 'Fortnightly', weekly: 'Weekly' }

function CreateStokvelSheet({ onClose, ref }: { onClose: () => void; ref: Ref<HTMLElement> }) {
  const create = useCreateStokvel()
  const now = new Date()
  const [name, setName] = useState('')
  const [type, setType] = useState<StokvelType>('rotating')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<StokvelFrequency>('monthly')
  const [day, setDay] = useState('1')
  const [start, setStart] = useState(currentMonth(now).slice(0, 7))
  const [count, setCount] = useState('12')
  const [position, setPosition] = useState('1')
  const [names, setNames] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [payoutDate, setPayoutDate] = useState(`${now.getFullYear()}-12-05`)
  const [interest, setInterest] = useState('')
  const [link, setLink] = useState(true)

  const rotating = type === 'rotating'
  const memberCount = Math.max(2, Math.min(200, Math.round(Number(count) || 0)))
  // With names entered, the order list decides your position ("You" is one of the rows).
  const order = names.length > 0 ? names : []
  const myIndex = order.indexOf('You')

  function move(i: number, d: -1 | 1) {
    setNames((list) => {
      const next = [...list]
      const j = i + d
      if (j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!name.trim()) return toast.error('Give the stokvel a name.')
    if (!(value > 0)) return toast.error('Enter your contribution.')
    const pos = rotating ? (myIndex >= 0 ? myIndex + 1 : Math.round(Number(position))) : null
    if (rotating && (!pos || pos < 1 || pos > memberCount)) return toast.error(`Your turn must be between 1 and ${memberCount}.`)
    const members = rotating && order.length > 0 ? order.map((n) => ({ name: n === 'You' ? 'You' : n, is_me: n === 'You' })) : [{ name: 'You', is_me: true }]
    create.mutate(
      {
        stokvel: {
          name: name.trim(),
          type,
          contribution_amount: value,
          frequency,
          contribution_day: Math.min(31, Math.max(1, Math.round(Number(day) || 1))),
          start_month: `${start}-01`,
          member_count: rotating && order.length > 0 ? Math.max(2, order.length) : memberCount,
          my_position: pos,
          payout_date: !rotating && type !== 'burial' ? payoutDate : null,
          expected_interest_pct: !rotating && interest ? Number(interest) : null,
        },
        members,
        linkExpense: link,
      },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} added`)
          onClose()
        },
      },
    )
  }

  return (
    <InlineSheet ref={ref} title="Add a stokvel" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="sv-name">
              Name
            </label>
            <input id="sv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Kasi Savings Club" autoFocus />
          </div>
          <div className="sm:col-span-2">
            <span className="field-label">Type</span>
            <div className="overflow-x-auto [&_button]:whitespace-nowrap">
              <Segmented label="Stokvel type" value={type} onChange={setType} options={STOKVEL_TYPES.map((t) => ({ value: t, label: STOKVEL_TYPE_LABELS[t] }))} />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="sv-amount">
              Your contribution
            </label>
            <input id="sv-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
          </div>
          <div>
            <label className="field-label" htmlFor="sv-freq">
              How often
            </label>
            <Select id="sv-freq" value={frequency} onValueChange={(v) => setFrequency(v as StokvelFrequency)} options={(Object.keys(FREQ_LABELS) as StokvelFrequency[]).map((f) => ({ value: f, label: FREQ_LABELS[f] }))} />
          </div>
          <div>
            <label className="field-label" htmlFor="sv-day">
              Contribution day
            </label>
            <input id="sv-day" type="number" inputMode="numeric" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="sv-start">
              First month
            </label>
            <input id="sv-start" type="month" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </div>

        {rotating ? (
          <div className="space-y-3 rounded-2xl bg-fill p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="sv-count">
                  Members
                </label>
                <input id="sv-count" type="number" inputMode="numeric" min={2} max={200} value={order.length > 0 ? String(order.length) : count} disabled={order.length > 0} onChange={(e) => setCount(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="sv-pos">
                  Your turn
                </label>
                <input id="sv-pos" type="number" inputMode="numeric" min={1} max={memberCount} value={myIndex >= 0 ? String(myIndex + 1) : position} disabled={myIndex >= 0} onChange={(e) => setPosition(e.target.value)} />
              </div>
            </div>
            <div>
              <span className="field-label">Order (optional — names only)</span>
              {order.length > 0 && (
                <ol className="mb-2 divide-y divide-hairline overflow-hidden rounded-xl bg-surface">
                  {order.map((n, i) => (
                    <li key={`${n}-${i}`} className="flex items-center gap-2 px-3 py-2">
                      <span className="tnum w-6 text-[13px] text-muted-foreground">{i + 1}</span>
                      <span className={`flex-1 truncate text-[14px] ${n === 'You' ? 'font-semibold text-primary' : ''}`}>{n}</span>
                      <button type="button" aria-label={`Move ${n} up`} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-fill">
                        <ChevronUp size={15} />
                      </button>
                      <button type="button" aria-label={`Move ${n} down`} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-fill">
                        <ChevronDown size={15} />
                      </button>
                      <button type="button" aria-label={`Remove ${n}`} onClick={() => setNames((l) => l.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-fill">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Member name" aria-label="Member name" />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  onClick={() => {
                    if (!newName.trim()) return
                    setNames((l) => [...(l.includes('You') ? l : ['You', ...l]), newName.trim()])
                    setNewName('')
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : type !== 'burial' ? (
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-fill p-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="sv-payout">
                Payout date
              </label>
              <input id="sv-payout" type="date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="sv-interest">
                Expected interest % (optional)
              </label>
              <input id="sv-interest" type="number" inputMode="decimal" min={0} max={50} value={interest} onChange={(e) => setInterest(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="sv-count2">
                Members
              </label>
              <input id="sv-count2" type="number" inputMode="numeric" min={2} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            <label className="field-label" htmlFor="sv-count3">
              Members
            </label>
            <input id="sv-count3" type="number" inputMode="numeric" min={2} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        )}

        <SwitchRow
          checked={link}
          onChange={setLink}
          label="Count my contribution as a monthly commitment"
          hint="Adds it to your expenses, so Safe to spend leaves room for it."
        />

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className="btn btn-primary flex-[2]">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            Add stokvel
          </button>
        </div>
      </form>
    </InlineSheet>
  )
}

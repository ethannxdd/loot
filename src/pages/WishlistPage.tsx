import { ExternalLink, Hourglass, Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type Ref } from 'react'
import { toast } from 'sonner'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { SwitchRow } from '@/components/ui/Switch'
import { useAddWishlistItem, useDecideWishlist, useDeleteWishlistItem, useWishlist } from '@/hooks/useDecide'
import { useExpenses } from '@/hooks/useExpenses'
import { useFeature } from '@/hooks/useFeatures'
import { useGoals } from '@/hooks/useGoals'
import { useProfile } from '@/hooks/useProfile'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/categories'
import { checkAffordability, disposableIncome, safetyBufferAmount, type AffordabilityResult } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import { VERDICT_META } from '@/lib/verdict'
import {
  COOL_OFF_DAYS,
  COOL_OFF_LABELS,
  countdown,
  defaultCoolOff,
  effectiveStatus,
  savedByNotBuying,
  type CoolOffDays,
  type WishlistItem,
} from '@/lib/wishlist'

/** Rule 22: the verdict at ready time, from today's numbers (not saved to check history). */
function useFreshVerdict() {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const { data: goals = [] } = useGoals()
  return (item: WishlistItem): AffordabilityResult | null => {
    if (!profile) return null
    return checkAffordability({
      itemName: item.name,
      amount: item.target_price ?? item.price,
      isRecurring: false,
      disposableIncome: disposableIncome(profile.net_income, expenses),
      safetyBuffer: safetyBufferAmount(profile.net_income, profile.safety_buffer_pct),
      savingsBalance: goals.filter((g) => !g.is_completed).reduce((s, g) => s + g.current_amount, 0),
      emergencyFundTarget: goals.find((g) => g.category === 'emergency_fund')?.target_amount,
    })
  }
}

/** /wishlist (§4.4): cool off before you buy. */
export function WishlistPage() {
  const { data: items = [], isLoading } = useWishlist()
  const [adding, setAdding] = useState(false)
  const formRef = useRef<HTMLElement>(null)
  const now = new Date()
  const withStatus = items.map((i) => ({ item: i, status: effectiveStatus(i, now) }))
  const ready = withStatus.filter((x) => x.status === 'ready')
  const waiting = withStatus.filter((x) => x.status === 'waiting' || x.status === 'snoozed')
  const decided = withStatus.filter((x) => x.status === 'bought' || x.status === 'dropped')

  function open() {
    setAdding(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Wishlist"
        subtitle="Give it a few days. If you still want it when the cooling-off ends, Loot checks it against your numbers that day."
        actions={
          <button type="button" onClick={open} className="btn btn-primary" data-tutorial="wishlist-add">
            <Plus size={16} strokeWidth={2.4} /> Add something
          </button>
        }
      />

      <StatStrip
        items={[
          { label: 'Waiting', value: String(waiting.length) },
          { label: 'Ready', value: String(ready.length), valueColor: ready.length > 0 ? 'var(--accent)' : undefined },
          { label: 'Not spent', value: formatCurrency(savedByNotBuying(items)), sub: 'by dropping things', valueColor: 'var(--accent)' },
        ]}
      />

      {adding && <AddWishSheet ref={formRef} onClose={() => setAdding(false)} />}

      {isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : items.length === 0 && !adding ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-tint)] text-primary">
            <Hourglass size={26} strokeWidth={1.8} />
          </span>
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">Nothing on your wishlist</h2>
          <p className="max-w-sm text-[14px] text-muted-foreground">Next time you want something, add it here instead of buying it straight away.</p>
          <button type="button" onClick={open} className="btn btn-primary mt-1">
            <Plus size={16} strokeWidth={2.4} /> Add something
          </button>
        </div>
      ) : (
        <>
          {ready.length > 0 && (
            <div className="space-y-3">
              <h2 className="card-title px-1">Ready to decide</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ready.map(({ item }) => (
                  <ReadyCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
          {waiting.length > 0 && (
            <div className="space-y-3">
              <h2 className="card-title px-1">Cooling off</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {waiting.map(({ item }) => (
                  <WaitingCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
          {decided.length > 0 && (
            <div className="space-y-2">
              <h2 className="card-title px-1">Decided</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
                {decided.map(({ item, status }, i) => (
                  <li key={item.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                    <span className="min-w-0 truncate text-[14.5px]">{item.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-[14px] font-semibold">{formatCurrency(item.price)}</span>
                      <span className={`chip ${status === 'dropped' ? 'chip-positive' : 'chip-neutral'}`}>{status === 'dropped' ? 'Dropped' : 'Bought'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Ring({ fraction }: { fraction: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--fill-2)" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * fraction} ${c}`} transform="rotate(-90 26 26)" />
    </svg>
  )
}

function WaitingCard({ item }: { item: WishlistItem }) {
  const decide = useDecideWishlist()
  const remove = useDeleteWishlistItem()
  const [confirmSkip, setConfirmSkip] = useState(false)
  const cd = countdown(item.status === 'snoozed' && item.snoozed_until ? { added_at: item.added_at, ready_at: item.snoozed_until } : item)
  return (
    <section className="card space-y-3" data-testid="wish-waiting">
      <div className="flex items-center gap-3.5">
        <Ring fraction={cd.fraction} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{item.name}</p>
          <p className="text-[13px] text-muted-foreground">
            {item.status === 'snoozed' ? 'Snoozed · ' : ''}
            {cd.label}
          </p>
        </div>
        <span className="tnum text-[16px] font-bold">{formatCurrency(item.target_price ?? item.price)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
            <ExternalLink size={13} /> Link
          </a>
        )}
        {confirmSkip ? (
          <>
            <span className="self-center text-[13px] text-muted-foreground">Skip the cooling-off?</span>
            <button type="button" onClick={() => decide.mutate({ item, action: 'buy_now', logSpend: true }, { onSuccess: () => toast.success(`Bought ${item.name}`) })} className="btn btn-secondary !min-h-9 !px-3 !text-[13px]">
              Yes, buy now
            </button>
            <button type="button" onClick={() => setConfirmSkip(false)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
              Keep waiting
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirmSkip(true)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
              Buy now anyway
            </button>
            <button type="button" onClick={() => decide.mutate({ item, action: 'drop' }, { onSuccess: () => toast.success(`Dropped. That’s ${formatCurrency(item.price)} not spent.`) })} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
              Drop it
            </button>
            <button type="button" aria-label={`Delete ${item.name}`} onClick={() => remove.mutate(item.id)} className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-fill hover:text-alert">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </section>
  )
}

function ReadyCard({ item }: { item: WishlistItem }) {
  const fresh = useFreshVerdict()
  const decide = useDecideWishlist()
  const live = useFeature('live_cycle')
  const [logIt, setLogIt] = useState(true)
  const verdict = useMemo(() => fresh(item), [fresh, item])
  const meta = verdict ? VERDICT_META[verdict.verdict] : null
  const Icon = meta?.icon
  return (
    <section className="object-card space-y-4 p-6" data-testid="wish-ready">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/60">Cooling-off’s over</p>
          <p className="truncate text-[22px] font-bold tracking-[-0.02em]">{item.name}</p>
        </div>
        <span className="tnum text-[20px] font-bold">{formatCurrency(item.target_price ?? item.price)}</span>
      </div>
      {verdict && meta && Icon && (
        <div className="rounded-2xl bg-white/8 p-4">
          <p className="flex items-center gap-2 text-[16px] font-semibold">
            <Icon size={18} /> {meta.label} today
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/75">{verdict.reasoning}</p>
        </div>
      )}
      {live && (
        <div className="[&_p]:!text-white/80">
          <SwitchRow checked={logIt} onChange={setLogIt} label="Log it as a spend" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ item, action: 'buy', verdict, logSpend: live && logIt }, { onSuccess: () => toast.success(`Enjoy your ${item.name}`) })} className="btn !bg-white !text-black">
          {decide.isPending && <Loader2 size={15} className="animate-spin" />}
          Buy it
        </button>
        <button type="button" onClick={() => decide.mutate({ item, action: 'snooze', verdict }, { onSuccess: () => toast('Snoozed for 7 days') })} className="btn !bg-white/12 !text-white">
          Not yet
        </button>
        <button type="button" onClick={() => decide.mutate({ item, action: 'drop', verdict }, { onSuccess: () => toast.success(`Dropped. That’s ${formatCurrency(item.price)} not spent.`) })} className="btn !bg-white/12 !text-white">
          Drop it
        </button>
      </div>
    </section>
  )
}

function AddWishSheet({ onClose, ref }: { onClose: () => void; ref: Ref<HTMLElement> }) {
  const add = useAddWishlistItem()
  const { data: profile } = useProfile()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('tech_gadgets')
  const [cool, setCool] = useState<CoolOffDays | null>(null)
  const [bf, setBf] = useState(false)
  const [target, setTarget] = useState('')
  const isNovember = new Date().getMonth() === 10
  const priceNum = Number(price) || 0
  const suggested = defaultCoolOff(priceNum, profile?.net_income ?? 0)
  const coolOff = cool ?? suggested

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('What is it?')
    if (!(priceNum > 0)) return toast.error('Enter the price.')
    const cleanUrl = url.trim()
    if (cleanUrl && !/^https?:\/\//.test(cleanUrl)) return toast.error('Links start with https://')
    add.mutate(
      {
        name: name.trim(),
        price: priceNum,
        url: cleanUrl || null,
        category,
        cool_off_days: coolOff,
        tags: bf ? ['black_friday'] : [],
        target_price: bf && Number(target) > 0 ? Number(target) : null,
      },
      {
        onSuccess: () => {
          toast.success(`Added. Ready in ${COOL_OFF_LABELS[coolOff]}.`)
          onClose()
        },
      },
    )
  }

  return (
    <InlineSheet ref={ref} title="Add to wishlist" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="wish-name">
              What is it?
            </label>
            <input id="wish-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="AirPods" autoFocus />
          </div>
          <div>
            <label className="field-label" htmlFor="wish-price">
              Price
            </label>
            <input id="wish-price" type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="wish-category">
              Category
            </label>
            <Select id="wish-category" value={category} onValueChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="wish-url">
              Link (optional)
            </label>
            <input id="wish-url" type="url" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </div>
        </div>
        <div>
          <span className="field-label">Cooling-off</span>
          <Segmented full label="Cooling-off" value={String(coolOff)} onChange={(v) => setCool(Number(v) as CoolOffDays)} options={COOL_OFF_DAYS.map((d) => ({ value: String(d), label: COOL_OFF_LABELS[d] }))} />
          {cool === null && priceNum > 0 && <p className="mt-1.5 text-[12.5px] text-muted-foreground">Suggested for this price: {COOL_OFF_LABELS[suggested]}.</p>}
        </div>
        {isNovember && (
          <div className="space-y-2">
            <SwitchRow checked={bf} onChange={setBf} label="For Black Friday" hint="It shows in your Black Friday planner." />
            {bf && (
              <div>
                <label className="field-label" htmlFor="wish-target">
                  Target price (optional)
                </label>
                <input id="wish-target" type="number" inputMode="decimal" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={add.isPending} className="btn btn-primary flex-[2]">
            {add.isPending && <Loader2 size={16} className="animate-spin" />}
            Add to wishlist
          </button>
        </div>
      </form>
    </InlineSheet>
  )
}

import { CalendarClock, ExternalLink, Loader2, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { useRef, useState, type FormEvent, type Ref } from 'react'
import { toast } from 'sonner'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useContent } from '@/hooks/useContent'
import { useExpenses } from '@/hooks/useExpenses'
import { useDeleteRenewal, usePriceEvents, useRenewals, useSaveRenewal } from '@/hooks/useStayAhead'
import { categoryLabel } from '@/lib/categories'
import { dateKey } from '@/lib/sa-calendar'
import {
  comingUp,
  contractNudge,
  eventImpact,
  RENEWAL_KIND_LABELS,
  RENEWAL_KINDS,
  type Renewal,
  type RenewalKind,
} from '@/lib/stay-ahead'
import { formatCurrency } from '@/lib/utils'

type View = 'coming' | 'renewals' | 'prices'

const fmtDate = (d: Date) => d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

/** /renewals (§4.6): renewals, price changes that affect you, and the merged timeline. */
export function RenewalsPage() {
  const { data: renewals = [], isLoading } = useRenewals()
  const { data: events = [] } = usePriceEvents()
  const { data: expenses = [] } = useExpenses()
  const content = useContent()
  const remove = useDeleteRenewal()
  const [view, setView] = useState<View>('coming')
  const [editing, setEditing] = useState<Renewal | 'new' | null>(null)
  const formRef = useRef<HTMLElement>(null)
  const fuel = content.fuel_prices.petrol95.inland
  const timeline = comingUp({ renewals, events, expenses, fuelPrice: fuel })
  const active = renewals.filter((r) => !r.ended_at)
  const affecting = events.map((e) => ({ e, impact: eventImpact(e, expenses, fuel) })).filter((x) => x.impact !== null)

  function open(r: Renewal | 'new') {
    setEditing(r)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Stay ahead"
        title="Renewals & prices"
        subtitle="See increases and renewals before they hit your account."
        actions={
          <button type="button" onClick={() => open('new')} className="btn btn-primary">
            <Plus size={16} strokeWidth={2.4} /> Add a renewal
          </button>
        }
      />

      {editing && <RenewalSheet ref={formRef} renewal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <Segmented
        label="Renewals view"
        value={view}
        onChange={setView}
        options={[
          { value: 'coming', label: 'Coming up' },
          { value: 'renewals', label: 'Renewals' },
          { value: 'prices', label: 'Price changes' },
        ]}
      />

      {isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : view === 'coming' ? (
        timeline.length === 0 ? (
          <Empty icon={CalendarClock} text="Nothing coming up in the next 90 days. Add your insurance, contracts and licences so Loot can remind you." onAdd={() => open('new')} />
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]" data-testid="timeline">
            {timeline.map((t, i) => (
              <li key={t.key} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                <span className={`icon-tile !h-9 !w-9 ${t.type === 'renewal' ? '' : ''}`} style={{ background: t.type === 'renewal' ? 'var(--chart-2)' : 'var(--chart-5)' }}>
                  {t.type === 'renewal' ? <CalendarClock size={16} /> : <TrendingUp size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{t.title}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {fmtDate(t.date)} · {t.detail}
                  </p>
                </div>
                {t.amount !== null && (
                  <span className="tnum shrink-0 text-[14px] font-semibold">
                    {t.type === 'renewal' ? formatCurrency(t.amount) : `~${formatCurrency(t.amount)} more a month`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )
      ) : view === 'renewals' ? (
        active.length === 0 ? (
          <Empty icon={CalendarClock} text="No renewals yet. Insurance, contracts, warranties and licences all renew — add them once and forget." onAdd={() => open('new')} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {active.map((r) => {
              const nudge = contractNudge(r)
              return (
                <section key={r.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold">{r.name}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {[RENEWAL_KIND_LABELS[r.kind], r.provider].filter(Boolean).join(' · ')} · renews {fmtDate(new Date(`${r.renews_on}T00:00:00`))}
                      </p>
                    </div>
                    {r.amount !== null && (
                      <span className="tnum shrink-0 text-[15px] font-bold">
                        {formatCurrency(r.amount)}
                        <span className="text-[12px] font-medium text-muted-foreground">{r.frequency === 'monthly' ? '/mo' : r.frequency === 'annual' ? '/yr' : ''}</span>
                      </span>
                    )}
                  </div>
                  {nudge && <p className="rounded-xl bg-[var(--accent-tint)] px-3 py-2 text-[13px] text-primary">{nudge}</p>}
                  <div className="flex gap-1">
                    <button type="button" onClick={() => open(r)} className="btn btn-ghost !min-h-8 !px-2.5 !text-[13px]">
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(r.id, { onSuccess: () => toast.success('Renewal removed') })}
                      className="btn btn-ghost !min-h-8 !px-2.5 !text-[13px] text-alert"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </section>
              )
            })}
          </div>
        )
      ) : affecting.length === 0 ? (
        <div className="card py-10 text-center text-[14px] text-muted-foreground">
          No published price changes affect what you track right now. Loot adds fuel, electricity, medical aid and other increases as they’re announced.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
          {affecting.map(({ e, impact }, i) => (
            <li key={e.id} className={`space-y-1 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold">{e.title}</p>
                <span className="tnum shrink-0 text-[14px] font-semibold text-caution">~{formatCurrency(impact!)} a month</span>
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                {fmtDate(new Date(`${e.effective_on}T00:00:00`))} · {categoryLabel(e.category)} ·{' '}
                {e.change_pct != null ? `${e.change_pct > 0 ? '+' : ''}${e.change_pct}%` : `${e.change_amount! > 0 ? '+' : ''}${e.change_amount}${e.change_unit === 'c/l' ? 'c/l' : ''}`}
                {e.region !== 'all' ? ` · ${e.region}` : ''}
              </p>
              {e.description && <p className="text-[13px] text-muted-foreground">{e.description}</p>}
              {e.source_url && (
                <a href={e.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
                  Source <ExternalLink size={12} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Empty({ icon: Icon, text, onAdd }: { icon: typeof CalendarClock; text: string; onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-tint)] text-primary">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <p className="max-w-sm text-[14px] text-muted-foreground">{text}</p>
      <button type="button" onClick={onAdd} className="btn btn-primary mt-1">
        <Plus size={16} strokeWidth={2.4} /> Add a renewal
      </button>
    </div>
  )
}

function RenewalSheet({ renewal, onClose, ref }: { renewal: Renewal | null; onClose: () => void; ref: Ref<HTMLElement> }) {
  const save = useSaveRenewal()
  const { data: expenses = [] } = useExpenses()
  const [name, setName] = useState(renewal?.name ?? '')
  const [kind, setKind] = useState<RenewalKind>(renewal?.kind ?? 'insurance')
  const [provider, setProvider] = useState(renewal?.provider ?? '')
  const [amount, setAmount] = useState(renewal?.amount != null ? String(renewal.amount) : '')
  const [frequency, setFrequency] = useState<Renewal['frequency']>(renewal?.frequency ?? 'monthly')
  const [renewsOn, setRenewsOn] = useState(renewal?.renews_on ?? dateKey(new Date(new Date().getFullYear() + 1, new Date().getMonth(), 1)))
  const [expenseId, setExpenseId] = useState(renewal?.expense_id ?? '')
  const [reminder, setReminder] = useState(String(renewal?.reminder_days ?? 30))
  const [notes, setNotes] = useState(renewal?.notes ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Give it a name.')
    save.mutate(
      {
        id: renewal?.id,
        values: {
          name: name.trim(),
          kind,
          provider: provider.trim() || null,
          amount: amount === '' ? null : Number(amount),
          frequency,
          renews_on: renewsOn,
          expense_id: expenseId || null,
          reminder_days: Math.min(120, Math.max(0, Math.round(Number(reminder) || 0))),
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(renewal ? 'Renewal saved' : 'Renewal added')
          onClose()
        },
      },
    )
  }

  return (
    <InlineSheet ref={ref} title={renewal ? 'Edit renewal' : 'Add a renewal'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="rn-name">
              Name
            </label>
            <input id="rn-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Car insurance" autoFocus />
          </div>
          <div>
            <label className="field-label" htmlFor="rn-kind">
              Kind
            </label>
            <Select id="rn-kind" value={kind} onValueChange={(v) => setKind(v as RenewalKind)} options={RENEWAL_KINDS.map((k) => ({ value: k, label: RENEWAL_KIND_LABELS[k] }))} />
          </div>
          <div>
            <label className="field-label" htmlFor="rn-provider">
              Provider
            </label>
            <input id="rn-provider" value={provider} maxLength={80} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="rn-amount">
              Amount
            </label>
            <input id="rn-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="rn-freq">
              How often
            </label>
            <Select
              id="rn-freq"
              value={frequency}
              onValueChange={(v) => setFrequency(v as Renewal['frequency'])}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'annual', label: 'Yearly' },
                { value: 'once-off', label: 'Once-off' },
              ]}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="rn-date">
              Renews on
            </label>
            <input id="rn-date" type="date" value={renewsOn} onChange={(e) => setRenewsOn(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="rn-remind">
              Remind me
            </label>
            <input id="rn-remind" type="number" inputMode="numeric" min={0} max={120} value={reminder} onChange={(e) => setReminder(e.target.value)} />
            <p className="mt-1 text-[12.5px] text-muted-foreground">days before (and again 7 days before)</p>
          </div>
          {expenses.length > 0 && (
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="rn-expense">
                Linked expense (optional)
              </label>
              <Select
                id="rn-expense"
                value={expenseId}
                placeholder="None"
                onValueChange={setExpenseId}
                options={expenses.filter((x) => !x.deleted_at).map((x) => ({ value: x.id, label: x.name }))}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="rn-notes">
              Notes
            </label>
            <textarea id="rn-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className="btn btn-primary flex-[2]">
            {save.isPending && <Loader2 size={16} className="animate-spin" />}
            {renewal ? 'Save' : 'Add renewal'}
          </button>
        </div>
      </form>
    </InlineSheet>
  )
}

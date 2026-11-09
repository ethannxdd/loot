import { CalendarDays, PartyPopper, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { useUpdateProfile } from '@/hooks/useProfile'
import { cycleFor, cycleForMonth, DEFAULT_PAYDAY, paydayPatch, type Cycle, type PaydaySettings, type PaydayValue } from '@/lib/cycle'
import { safeToSpend, type Budget, type SpendEntry } from '@/lib/spending'
import { formatCurrency } from '@/lib/utils'
import { PaydayPicker } from './PaydayPicker'

/** One-time Summary card for people with payday cycles on but no payday set (§3.1). Dismiss = stay on calendar months. */
export function PaydayPromptCard() {
  const update = useUpdateProfile()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<PaydayValue>(DEFAULT_PAYDAY)

  function save() {
    const patch = paydayPatch(value)
    // Seen = this cycle, so the payday moment doesn't fire for a payday that has already been and gone.
    const key = cycleFor(new Date(), patch).key
    update.mutate(
      { ...patch, last_payday_seen: key },
      { onSuccess: () => toast.success('Payday saved. Loot now runs payday to payday.') },
    )
  }

  return (
    <section className="card space-y-4" data-testid="payday-prompt">
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-tint)] text-primary">
          <CalendarDays size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold">When do you get paid?</h3>
          <p className="text-[13.5px] text-muted-foreground">
            Loot can run from payday to payday instead of the 1st to the 31st, so “a day” and “left” match your real month.
          </p>
        </div>
        <button
          type="button"
          onClick={() => update.mutate({ payday_prompt_dismissed_at: new Date().toISOString() })}
          aria-label="Not now — keep calendar months"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
      {open ? (
        <div className="space-y-4 sm:max-w-md">
          <PaydayPicker value={value} onChange={setValue} idPrefix="prompt-payday" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={update.isPending} className="btn btn-primary flex-[2]">
              Save payday
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
          Set my payday
        </button>
      )}
    </section>
  )
}

/**
 * The payday moment (§3.8): the first open in a new cycle shows "It's payday", the new Safe to spend counting up and
 * one line on how the last cycle ended. Dismissing stores the cycle key so it never shows twice.
 */
export function PaydayMomentCard({
  cycle,
  safe,
  settings,
  disposable,
  buffer,
  budgets,
  entries,
}: {
  cycle: Cycle
  safe: number
  settings: PaydaySettings
  disposable: number
  buffer: number
  budgets: Budget[]
  entries: SpendEntry[]
}) {
  const update = useUpdateProfile()
  const [y, m] = cycle.key.split('-').map(Number)
  const previous = cycleForMonth(y, m - 2, settings)
  const last = safeToSpend({ disposable, buffer, budgets, entries, cycle: previous })

  return (
    <section className="object-card animate-enter p-6 sm:p-7" data-testid="payday-moment">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-white/70">
            <PartyPopper size={17} strokeWidth={2} /> It’s payday
          </p>
          <p className="tnum mt-3 text-[40px] leading-none font-bold tracking-[-0.04em] sm:text-[48px]">
            <AnimatedNumber value={safe} from={0} render={(n) => formatCurrency(n)} />
          </p>
          <p className="mt-2 text-[14px] text-white/70">Safe to spend this cycle · {cycle.rangeLabel}</p>
          {last.entryCount > 0 && (
            <p className="mt-3 text-[14px] text-white/85">
              {last.safe >= 0
                ? `You finished ${previous.shortLabel} ${formatCurrency(last.safe)} ahead.`
                : `${previous.shortLabel} ended ${formatCurrency(Math.abs(last.safe))} over. A fresh start now.`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => update.mutate({ last_payday_seen: cycle.key })}
          aria-label="Dismiss"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 text-white/80 hover:text-white"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </section>
  )
}

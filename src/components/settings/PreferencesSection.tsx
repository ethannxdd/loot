import { Link } from '@tanstack/react-router'
import { Bell, Globe, Landmark, Loader2, Shield, Target } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Select } from '@/components/ui/Select'
import { useUpdateProfile } from '@/hooks/useProfile'
import { useTaxProfile } from '@/hooks/useTaxProfile'
import { normalizeAllocationMode, normalizeAutoTiming } from '@/lib/goal-math'
import { safetyBufferAmount } from '@/lib/money'
import type { Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-primary' : 'bg-surface-3'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

export function PreferencesSection({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const { data: taxProfile } = useTaxProfile()
  const [buffer, setBuffer] = useState(String(profile.safety_buffer_pct))

  const bufferNum = Number(buffer)
  const bufferValid = Number.isFinite(bufferNum) && bufferNum >= 0 && bufferNum <= 50
  const bufferDirty = bufferNum !== profile.safety_buffer_pct

  function saveBuffer(e: FormEvent) {
    e.preventDefault()
    if (!bufferValid) return toast.error('Choose a buffer between 0% and 50%.')
    update.mutate({ safety_buffer_pct: bufferNum }, { onSuccess: () => toast.success('Safety buffer saved') })
  }

  return (
    <>
      <form onSubmit={saveBuffer} className="card space-y-4">
        <div className="overline-label flex items-center gap-1.5">
          <Shield size={13} strokeWidth={2} /> Financial
        </div>
        <div>
          <label className="field-label" htmlFor="settings-buffer">
            Safety buffer (% of net income)
          </label>
          <div className="flex gap-3">
            <input
              id="settings-buffer"
              type="number"
              inputMode="decimal"
              min={0}
              max={50}
              step="0.5"
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
              className="max-w-32"
            />
            <button type="submit" disabled={!bufferDirty || !bufferValid || update.isPending} className="btn btn-primary">
              {update.isPending && <Loader2 size={16} className="animate-spin" />}
              Save
            </button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            The cushion the Affordability Checker keeps untouched
            {bufferValid && profile.net_income > 0 && (
              <>
                {' '}
                — <span className="tnum font-semibold text-foreground">{formatCurrency(safetyBufferAmount(profile.net_income, bufferNum))}</span> a
                month at your current income
              </>
            )}
            . The default is 12.5%.
          </p>
        </div>
        <p className="text-xs text-text-muted">
          Your emergency fund target lives on the{' '}
          <Link to="/goals" className="font-semibold text-primary">
            Goals
          </Link>{' '}
          page — create a goal in the “Emergency fund” category and the checker will use it.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline p-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <Globe size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Multi-currency expenses</p>
              <p className="text-xs text-text-muted">
                Adds a currency and exchange rate to the expense form, for costs you pay in a foreign currency. Rates are
                entered by you — Loot doesn’t fetch live ones.
              </p>
            </div>
          </div>
          <Toggle
            label="Multi-currency expenses"
            checked={profile.multi_currency_enabled}
            disabled={update.isPending}
            onChange={(next) =>
              update.mutate({ multi_currency_enabled: next }, { onSuccess: () => toast.success(next ? 'Multi-currency on' : 'Multi-currency off') })
            }
          />
        </div>
      </form>

      <section className="card space-y-4">
        <div className="overline-label flex items-center gap-1.5">
          <Target size={13} strokeWidth={2} /> Goals — auto progress
        </div>
        <p className="text-sm text-muted-foreground">
          Goals set to “Auto-fund” share your spare loot each month — your disposable income after the safety buffer.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="settings-alloc-mode">
              How to split it
            </label>
            <Select
              id="settings-alloc-mode"
              value={normalizeAllocationMode(profile.auto_allocation_mode)}
              disabled={update.isPending}
              onValueChange={(v) => update.mutate({ auto_allocation_mode: v }, { onSuccess: () => toast.success('Saved') })}
              options={[
                { value: 'weighted', label: 'By share weight (shared out together)' },
                { value: 'sequential', label: 'In priority order (top goal first)' },
              ]}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="settings-alloc-timing">
              When to add it
            </label>
            <Select
              id="settings-alloc-timing"
              value={normalizeAutoTiming(profile.auto_contribution_timing)}
              disabled={update.isPending}
              onValueChange={(v) => update.mutate({ auto_contribution_timing: v }, { onSuccess: () => toast.success('Saved') })}
              options={[
                { value: 'on_demand', label: 'When I press Apply' },
                { value: 'monthly_1st', label: 'Automatically each month' },
                { value: 'estimate_only', label: 'Estimates only' },
              ]}
            />
          </div>
        </div>
        <p className="text-xs text-text-muted">
          “Automatically each month” adds each goal’s share the first time you open Loot in a new month. Amounts are
          only tracked in Loot — Loot never moves real money.
        </p>
      </section>

      <section className="card space-y-3">
        <div className="overline-label flex items-center gap-1.5">
          <Bell size={13} strokeWidth={2} /> Notifications
        </div>
        <p className="text-sm text-muted-foreground">
          Loot’s in-app notifications — upcoming debits, tax deadlines, goal milestones, spending alerts and your monthly
          briefing — are always on. Find them under the bell. Expenses can each set how many days ahead to remind you.
        </p>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline p-3.5 opacity-70">
          <div>
            <p className="text-sm font-semibold">
              Email reminders <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-text-muted">Coming soon</span>
            </p>
            <p className="text-xs text-text-muted">Get the same reminders in your inbox.</p>
          </div>
          <Toggle label="Email reminders" checked={false} disabled onChange={() => undefined} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline p-3.5 opacity-70">
          <div>
            <p className="text-sm font-semibold">
              Push notifications <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-text-muted">Coming soon</span>
            </p>
            <p className="text-xs text-text-muted">Arrives with the Loot mobile app.</p>
          </div>
          <Toggle label="Push notifications" checked={false} disabled onChange={() => undefined} />
        </div>
      </section>

      <section className="card space-y-3">
        <div className="overline-label flex items-center gap-1.5">
          <Landmark size={13} strokeWidth={2} /> Tax
        </div>
        {taxProfile ? (
          <p className="text-sm text-muted-foreground">
            Your tax profile is set up
            {taxProfile.is_provisional_taxpayer === 'yes' ? ' — you’re a provisional taxpayer' : ''}. Update it any time from the Tax Centre.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Answer a few questions to unlock your SARS estimate, provisional tax dates and deduction tracker.
          </p>
        )}
        <Link to="/tax" className="btn btn-ghost">
          {taxProfile ? 'Open Tax Centre' : 'Set up my tax profile'}
        </Link>
      </section>
    </>
  )
}

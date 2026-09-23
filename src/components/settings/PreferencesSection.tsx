import { Link } from '@tanstack/react-router'
import { Bell, ChevronRight, Globe, Landmark, Loader2, Shield, Target } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { BufferInput } from '@/components/ui/BufferInput'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useUpdateProfile } from '@/hooks/useProfile'
import { useTaxProfile } from '@/hooks/useTaxProfile'
import { normalizeAllocationMode, normalizeAutoTiming } from '@/lib/goal-math'
import { safetyBufferAmount } from '@/lib/money'
import type { Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

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
        <SettingsHeading icon={Shield} title="Safety buffer" color="var(--chart-1)" description="The cushion “Can I afford it?” never touches." />
        <BufferInput netIncome={profile.net_income} pct={buffer} onPctChange={setBuffer} idPrefix="settings-buffer" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            {bufferValid ? (
              <>
                {bufferNum}% of your take-home
                {profile.net_income > 0 && (
                  <>
                    {' '}
                    = <span className="tnum font-semibold text-foreground">{formatCurrency(safetyBufferAmount(profile.net_income, bufferNum))}</span> a month
                  </>
                )}
                . The default is 12.5%.
              </>
            ) : (
              <span className="font-medium text-alert">Choose a buffer between 0% and 50% of your take-home.</span>
            )}
          </p>
          <button type="submit" disabled={!bufferDirty || !bufferValid || update.isPending} className="btn btn-primary">
            {update.isPending && <Loader2 size={16} className="animate-spin" />}
            Save buffer
          </button>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Your emergency fund target lives on the{' '}
          <Link to="/goals" className="font-semibold text-primary">
            Goals
          </Link>{' '}
          page — create a goal in the “Emergency fund” category and the checker will use it.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-fill p-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <Globe size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[15px] font-medium">Multi-currency expenses</p>
              <p className="text-[13px] text-muted-foreground">
                Adds a currency and exchange rate to the expense form, for costs you pay in a foreign currency. Rates are
                entered by you — Loot doesn’t fetch live ones.
              </p>
            </div>
          </div>
          <Switch
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
        <SettingsHeading icon={Target} title="Goal auto-funding" color="var(--chart-4)" />
        <p className="text-[14px] text-muted-foreground">
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
        <p className="text-[13px] text-muted-foreground">
          “Automatically each month” adds each goal’s share the first time you open Loot in a new month. Amounts are
          only tracked in Loot — Loot never moves real money.
        </p>
      </section>

      <section className="card space-y-3">
        <SettingsHeading icon={Bell} title="Notifications" color="var(--chart-5)" />
        <p className="text-[14px] text-muted-foreground">
          Loot’s in-app notifications — upcoming debits, tax deadlines, goal milestones, spending alerts and your monthly
          briefing — are always on. Find them under the bell. Expenses can each set how many days ahead to remind you.
        </p>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-fill p-3.5 opacity-70">
          <div>
            <p className="text-[15px] font-medium">
              Email reminders <span className="chip chip-neutral ml-1.5 align-middle">Coming soon</span>
            </p>
            <p className="text-[13px] text-muted-foreground">Get the same reminders in your inbox.</p>
          </div>
          <Switch label="Email reminders" checked={false} disabled onChange={() => undefined} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-fill p-3.5 opacity-70">
          <div>
            <p className="text-[15px] font-medium">
              Push notifications <span className="chip chip-neutral ml-1.5 align-middle">Coming soon</span>
            </p>
            <p className="text-[13px] text-muted-foreground">Arrives with the Loot mobile app.</p>
          </div>
          <Switch label="Push notifications" checked={false} disabled onChange={() => undefined} />
        </div>
      </section>

      <section className="card space-y-3">
        <SettingsHeading icon={Landmark} title="Tax" color="var(--chart-2)" />
        {taxProfile ? (
          <p className="text-[14px] text-muted-foreground">
            Your tax profile is set up
            {taxProfile.is_provisional_taxpayer === 'yes' ? ' — you’re a provisional taxpayer' : ''}. Update it any time from the Tax centre.
          </p>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            Answer a few questions to unlock your SARS estimate, provisional tax dates and deduction tracker.
          </p>
        )}
        <Link to="/tax" className="btn btn-secondary">
          {taxProfile ? 'Open Tax centre' : 'Set up my tax profile'} <ChevronRight size={16} strokeWidth={2.2} />
        </Link>
      </section>
    </>
  )
}

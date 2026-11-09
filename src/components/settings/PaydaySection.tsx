import { CalendarDays, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { PaydayPicker } from '@/components/spending/PaydayPicker'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useUpdateProfile } from '@/hooks/useProfile'
import { cycleFor, nextCycle, paydayPatch, paydayValueFrom, type PaydayValue } from '@/lib/cycle'
import type { Profile } from '@/lib/types'

/**
 * Settings → Payday (§3.1, shown with `live_cycle` on). Changing an existing payday shows what happens to the cycle
 * you're in; locked snapshots never move because their keys stay 'YYYY-MM-01'.
 */
export function PaydaySection({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const saved = paydayValueFrom({ payday_day: profile.payday_day ?? null, payday_rule: profile.payday_rule ?? null })
  const [value, setValue] = useState<PaydayValue>(saved)
  const [confirming, setConfirming] = useState(false)

  const patch = paydayPatch(value)
  const savedPatch = paydayPatch(saved)
  const dirty = patch.payday_day !== savedPatch.payday_day || patch.payday_rule !== savedPatch.payday_rule

  const now = new Date()
  const newCurrent = cycleFor(now, patch.payday_day == null ? null : patch)
  const newNext = nextCycle(patch.payday_day == null ? null : patch, now)

  function commit() {
    update.mutate(
      { ...patch, last_payday_seen: newCurrent.key },
      {
        onSuccess: () => {
          setConfirming(false)
          toast.success(patch.payday_day == null ? 'Back to calendar months' : 'Payday saved')
        },
      },
    )
  }

  return (
    <section className="card space-y-4" data-testid="payday-section">
      <SettingsHeading
        icon={CalendarDays}
        title="Payday"
        color="var(--chart-2)"
        description="Loot runs your month from payday to the day before the next one."
      />
      <div className="sm:max-w-md">
        <PaydayPicker value={value} onChange={setValue} idPrefix="settings-payday" allowUnset />
      </div>
      <button
        type="button"
        disabled={!dirty || update.isPending}
        onClick={() => (saved.day == null ? commit() : setConfirming(true))}
        className="btn btn-primary w-full sm:w-auto"
      >
        {update.isPending && <Loader2 size={16} className="animate-spin" />}
        Save payday
      </button>

      {confirming && (
        <ConfirmModal
          title="Change your payday?"
          confirmLabel="Change payday"
          destructive={false}
          isPending={update.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={commit}
        >
          <p>
            Your current cycle will run <b className="text-foreground">{newCurrent.rangeLabel}</b>, then{' '}
            <b className="text-foreground">{newNext.rangeLabel}</b> and so on. Months you’ve already closed don’t change.
          </p>
        </ConfirmModal>
      )}
    </section>
  )
}

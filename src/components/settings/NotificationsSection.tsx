import { Link } from '@tanstack/react-router'
import { Bell, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { SettingsHeading } from '@/components/settings/SettingsHeading'
import { Switch } from '@/components/ui/Switch'
import { useFeatureFlags } from '@/hooks/useFeatures'
import { usePushDevice, usePushSummary, useSetPushKind, useTogglePush } from '@/hooks/usePush'
import { kindEnabled, PUSH_KIND_LABELS, PUSH_KINDS, type PushKind } from '@/lib/server-notifications'
import type { Profile } from '@/lib/types'

/** Which feature flag a kind belongs to — kinds for features that are off aren't shown. */
const KIND_FLAG: Partial<Record<PushKind, string>> = {
  payday: 'live_cycle',
  pace: 'live_cycle',
  budget_low: 'live_cycle',
  wishlist_ready: 'wishlist',
  renewal: 'renewals',
  price_change: 'renewals',
  stokvel: 'stokvels',
  split: 'splits',
  challenge: 'challenges',
  feedback_reply: 'feedback',
}

/** Settings → Notifications with push (§3.4, flag `push`). Replaces the old "Coming soon" card. */
export function NotificationsSection({ profile }: { profile: Profile }) {
  const { data: flags } = useFeatureFlags()
  const { data: device, isLoading } = usePushDevice()
  const { data: devices = [] } = usePushSummary()
  const toggle = useTogglePush()
  const setKind = useSetPushKind()
  const prefs = profile.notification_prefs ?? {}
  const kinds = PUSH_KINDS.filter((k) => !KIND_FLAG[k] || flags?.[KIND_FLAG[k]!] === true)

  function onToggle(next: boolean) {
    toggle.mutate(next, {
      onSuccess: () => toast.success(next ? 'Push is on for this device' : 'Push is off for this device'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Couldn’t change push.'),
    })
  }

  return (
    <section className="card space-y-4" data-testid="notifications-section">
      <SettingsHeading
        icon={Bell}
        title="Notifications"
        color="var(--chart-5)"
        description="Everything also appears under the bell. Push sends the important ones to your phone or computer."
      />

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-fill p-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <Smartphone size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[15px] font-medium">Push on this device</p>
            {device?.support === 'ios-needs-install' ? (
              <p className="text-[13px] text-muted-foreground">
                On iPhone, push only works in the installed app.{' '}
                <Link to="/settings" hash="install" className="font-semibold text-primary">
                  Install Loot first
                </Link>
                , then switch this on from the app.
              </p>
            ) : device?.support === 'unsupported' ? (
              <p className="text-[13px] text-muted-foreground">This browser can’t receive push notifications.</p>
            ) : device?.support === 'not-configured' ? (
              <p className="text-[13px] text-muted-foreground">Push isn’t set up on this Loot server yet.</p>
            ) : device?.permission === 'denied' ? (
              <p className="text-[13px] text-alert">Notifications are blocked. Allow them for Loot in your browser or phone settings.</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                {devices.length > 0 ? `On for ${devices.length} device${devices.length === 1 ? '' : 's'}.` : 'Off on all your devices.'} Never
                between 21:00 and 07:00, and at most three a day.
              </p>
            )}
          </div>
        </div>
        {isLoading || toggle.isPending ? (
          <Loader2 size={18} className="shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            label="Push on this device"
            checked={Boolean(device?.subscribed)}
            disabled={device?.support !== 'supported' || device?.permission === 'denied'}
            onChange={onToggle}
          />
        )}
      </div>

      <div>
        <p className="mb-1 px-1 text-[13px] font-semibold text-muted-foreground">Send me</p>
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-fill">
          {kinds.map((k) => (
            <li key={k} className="flex items-center justify-between gap-4 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{PUSH_KIND_LABELS[k].label}</p>
                <p className="text-[13px] text-muted-foreground">{PUSH_KIND_LABELS[k].hint}</p>
              </div>
              <Switch
                label={PUSH_KIND_LABELS[k].label}
                checked={kindEnabled(prefs, k)}
                disabled={setKind.isPending}
                onChange={(on) => setKind.set(prefs, k, on)}
              />
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[13px] text-muted-foreground">Loot never sends email. Expenses can each set how many days ahead to remind you.</p>
    </section>
  )
}

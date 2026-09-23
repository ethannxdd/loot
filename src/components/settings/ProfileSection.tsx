import { Loader2, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateProfile } from '@/hooks/useProfile'
import { CURRENCIES, CURRENCY_LABELS, PAY_FREQUENCIES, type CurrencyCode, type PayFrequency, type Profile } from '@/lib/types'
import { SettingsHeading } from '@/components/settings/SettingsHeading'

const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Every two weeks',
  weekly: 'Weekly',
}

export function ProfileSection({ profile }: { profile: Profile }) {
  const { user } = useAuth()
  const update = useUpdateProfile()
  const [name, setName] = useState(profile.display_name ?? '')
  const [currency, setCurrency] = useState<string>(profile.currency_code)
  const [frequency, setFrequency] = useState<string>(profile.pay_frequency)

  const dirty =
    name.trim() !== (profile.display_name ?? '') ||
    currency !== profile.currency_code ||
    frequency !== profile.pay_frequency

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Your name can’t be empty.')
    update.mutate(
      { display_name: name.trim(), currency_code: currency, pay_frequency: frequency },
      { onSuccess: () => toast.success('Profile saved') },
    )
  }

  // A profile saved with a currency that isn't in the list (e.g. set by an older version) must still be selectable.
  const currencyOptions: string[] = CURRENCIES.includes(currency as CurrencyCode) ? [...CURRENCIES] : [currency, ...CURRENCIES]

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <SettingsHeading icon={User} title="Profile" color="var(--label-3)" />

      <div>
        <label className="field-label" htmlFor="settings-name">
          Display name
        </label>
        <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <p className="field-label">Email</p>
        <p className="truncate rounded-xl bg-fill px-3.5 py-3 text-[15px] text-muted-foreground">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="settings-currency">
            Currency
          </label>
          <Select
            id="settings-currency"
            value={currency}
            onValueChange={setCurrency}
            options={currencyOptions.map((code) => ({ value: code, label: CURRENCY_LABELS[code as CurrencyCode] ?? code }))}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="settings-frequency">
            Pay frequency
          </label>
          <Select
            id="settings-frequency"
            value={frequency}
            onValueChange={setFrequency}
            options={PAY_FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
          />
        </div>
      </div>
      {currency !== profile.currency_code && (
        <p className="text-[13px] text-muted-foreground">
          Changing currency relabels your figures — it doesn’t convert them. Update your income and expenses if the amounts
          should change too.
        </p>
      )}

      <button type="submit" disabled={!dirty || update.isPending} className="btn btn-primary w-full sm:w-auto">
        {update.isPending && <Loader2 size={16} className="animate-spin" />}
        Save profile
      </button>
    </form>
  )
}

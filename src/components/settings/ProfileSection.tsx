import { Loader2, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateProfile } from '@/hooks/useProfile'
import { CURRENCIES, CURRENCY_LABELS, PAY_FREQUENCIES, type CurrencyCode, type PayFrequency, type Profile } from '@/lib/types'

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
      <div className="overline flex items-center gap-1.5">
        <User size={13} strokeWidth={2} /> Profile
      </div>

      <div>
        <label className="field-label" htmlFor="settings-name">
          Display name
        </label>
        <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <p className="field-label">Email</p>
        <p className="rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-sm text-text-muted">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="settings-currency">
            Currency
          </label>
          <select id="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {CURRENCY_LABELS[code as CurrencyCode] ?? code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="settings-frequency">
            Pay frequency
          </label>
          <select id="settings-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {PAY_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {currency !== profile.currency_code && (
        <p className="text-xs text-text-muted">
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

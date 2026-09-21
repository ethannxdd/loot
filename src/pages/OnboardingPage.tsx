import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Logo } from '@/components/ui/Logo'
import { useUpdateProfile } from '@/hooks/useProfile'
import { upsertCurrentMonthSnapshot } from '@/lib/snapshot'
import { CURRENCIES, PAY_FREQUENCIES, type CurrencyCode, type PayFrequency } from '@/lib/types'
import { router } from '@/router'

const TOTAL_STEPS = 3

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  ZAR: 'South African Rand (ZAR)',
  USD: 'US Dollar (USD)',
  EUR: 'Euro (EUR)',
  GBP: 'British Pound (GBP)',
}

const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Every two weeks',
  weekly: 'Weekly',
}

export function OnboardingPage() {
  const updateProfile = useUpdateProfile()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('ZAR')
  const [payFrequency, setPayFrequency] = useState<PayFrequency>('monthly')
  const [grossIncome, setGrossIncome] = useState('')
  const [netIncome, setNetIncome] = useState('')
  const [safetyBufferPct, setSafetyBufferPct] = useState('12.5')

  const canAdvanceFromStep1 = displayName.trim().length > 0
  const canAdvanceFromStep2 = grossIncome !== '' && netIncome !== ''

  function goNext() {
    setError(null)
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  async function finish() {
    setError(null)
    try {
      const updated = await updateProfile.mutateAsync({
        display_name: displayName.trim(),
        currency_code: currencyCode,
        pay_frequency: payFrequency,
        gross_income: Number(grossIncome) || 0,
        net_income: Number(netIncome) || 0,
        safety_buffer_pct: Number(safetyBufferPct) || 12.5,
        onboarded_at: new Date().toISOString(),
      })
      await upsertCurrentMonthSnapshot(updated, [])
      router.navigate({ to: '/dashboard' })
    } catch {
      setError('Something went wrong saving your profile. Try again.')
    }
  }

  return (
    <div className="loot-gradient flex min-h-dvh items-center justify-center p-5">
      <div className="animate-enter card-elevated w-full max-w-md bg-background/95 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-sm font-bold">Loot</span>
          </div>
          <span className="overline">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        <div className="mb-6 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-primary' : 'bg-hairline'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">What should we call you?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                And which currency do you think in?
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="display-name">
                Your name
              </label>
              <input
                id="display-name"
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ethan"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="currency">
                Currency
              </label>
              <select
                id="currency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value as CurrencyCode)}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">How does your income work?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We use this to work out what you actually have left each month.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="pay-frequency">
                Pay frequency
              </label>
              <select
                id="pay-frequency"
                value={payFrequency}
                onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}
              >
                {PAY_FREQUENCIES.map((freq) => (
                  <option key={freq} value={freq}>
                    {FREQUENCY_LABELS[freq]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="gross-income">
                  Gross income
                </label>
                <input
                  id="gross-income"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="net-income">
                  Net income
                </label>
                <input
                  id="net-income"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={netIncome}
                  onChange={(e) => setNetIncome(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Set your safety buffer.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The share of your net income Loot always keeps aside before calling something
                affordable. 12.5% is a solid default.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="safety-buffer">
                Safety buffer (%)
              </label>
              <input
                id="safety-buffer"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={safetyBufferPct}
                onChange={(e) => setSafetyBufferPct(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-xs text-alert">{error}</p>}

        <div className="mt-7 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={goBack} className="btn btn-ghost flex-1">
              Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={
                (step === 1 && !canAdvanceFromStep1) || (step === 2 && !canAdvanceFromStep2)
              }
              className="btn btn-primary flex-1"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={updateProfile.isPending}
              className="btn btn-primary flex-1"
            >
              {updateProfile.isPending && <Loader2 size={16} className="animate-spin" />}
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

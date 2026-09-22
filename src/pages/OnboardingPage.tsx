import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Logo } from '@/components/ui/Logo'
import { Select } from '@/components/ui/Select'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { monthlyIncomeAmount } from '@/lib/money'
import { upsertCurrentMonthSnapshot } from '@/lib/snapshot'
import { formatCurrencyExact } from '@/lib/utils'
import { CURRENCIES, CURRENCY_LABELS, PAY_FREQUENCIES, type CurrencyCode, type PayFrequency } from '@/lib/types'
import { router } from '@/router'

const TOTAL_STEPS = 3

const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Every two weeks',
  weekly: 'Weekly',
}

export function OnboardingPage() {
  const updateProfile = useUpdateProfile()
  const { data: existingProfile } = useProfile()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // The signup trigger seeds display_name with the Google name (or the email address). Keep a real name,
  // but don't pre-fill something that is just an email.
  const seededName = existingProfile?.display_name ?? ''
  const [displayName, setDisplayName] = useState(seededName.includes('@') ? '' : seededName)
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('ZAR')
  const [payFrequency, setPayFrequency] = useState<PayFrequency>('monthly')
  const [grossIncome, setGrossIncome] = useState('')
  const [netIncome, setNetIncome] = useState('')
  const [safetyBufferPct, setSafetyBufferPct] = useState('12.5')

  const canAdvanceFromStep1 = displayName.trim().length > 0
  const canAdvanceFromStep2 =
    grossIncome !== '' && netIncome !== '' && Number(grossIncome) >= 0 && Number(netIncome) >= 0

  // Loot works in monthly figures. People paid weekly or fortnightly type what lands per pay, so convert.
  const payPeriodWord: Record<PayFrequency, string> = { monthly: 'month', biweekly: 'fortnight', weekly: 'week' }
  const toMonthly = (amount: string) => monthlyIncomeAmount(Number(amount) || 0, payFrequency)
  const bufferNumber = safetyBufferPct === '' ? 12.5 : Number(safetyBufferPct)
  const bufferValid = Number.isFinite(bufferNumber) && bufferNumber >= 0 && bufferNumber <= 50

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
        gross_income: Math.round(toMonthly(grossIncome) * 100) / 100,
        net_income: Math.round(toMonthly(netIncome) * 100) / 100,
        // 0% is a legitimate choice — only fall back to the default when the field is blank.
        safety_buffer_pct: bufferNumber,
        onboarded_at: new Date().toISOString(),
      })
      try {
        await upsertCurrentMonthSnapshot(updated, [])
      } catch (snapshotError) {
        // The profile is saved; the first snapshot is recreated automatically when the app loads.
        console.warn('First snapshot failed', snapshotError)
      }
      void router.navigate({ to: '/dashboard' })
    } catch {
      setError('Something went wrong saving your profile. Try again.')
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (step < TOTAL_STEPS) {
      const blocked = (step === 1 && !canAdvanceFromStep1) || (step === 2 && !canAdvanceFromStep2)
      if (!blocked) goNext()
    } else if (bufferValid && !updateProfile.isPending) {
      void finish()
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
          <span className="overline-label">
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

        <form onSubmit={handleSubmit} noValidate>
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
              <Select
                id="currency"
                value={currencyCode}
                onValueChange={(v) => setCurrencyCode(v as CurrencyCode)}
                options={CURRENCIES.map((code) => ({ value: code, label: CURRENCY_LABELS[code] }))}
              />
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
              <Select
                id="pay-frequency"
                value={payFrequency}
                onValueChange={(v) => setPayFrequency(v as PayFrequency)}
                options={PAY_FREQUENCIES.map((freq) => ({ value: freq, label: FREQUENCY_LABELS[freq] }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="gross-income">
                  Gross income per {payPeriodWord[payFrequency]}
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
                  Net income per {payPeriodWord[payFrequency]}
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
            {payFrequency !== 'monthly' && Number(netIncome) > 0 && (
              <p className="text-xs text-text-muted">
                That's about {formatCurrencyExact(toMonthly(netIncome), currencyCode)} a month take-home — Loot works in monthly figures.
              </p>
            )}
            {Number(grossIncome) > 0 && Number(netIncome) > Number(grossIncome) && (
              <p className="text-xs text-caution">Your take-home is higher than your gross income — double-check the two numbers.</p>
            )}
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
                max={50}
                step={0.5}
                value={safetyBufferPct}
                onChange={(e) => setSafetyBufferPct(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && !bufferValid && (
          <p role="alert" className="mt-3 text-xs text-alert">
            Choose a buffer between 0% and 50%.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-xs text-alert">
            {error}
          </p>
        )}

        <div className="mt-7 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={goBack} className="btn btn-ghost flex-1">
              Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              type="submit"
              disabled={
                (step === 1 && !canAdvanceFromStep1) || (step === 2 && !canAdvanceFromStep2)
              }
              className="btn btn-primary flex-1"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={updateProfile.isPending || !bufferValid}
              className="btn btn-primary flex-1"
            >
              {updateProfile.isPending && <Loader2 size={16} className="animate-spin" />}
              Finish
            </button>
          )}
        </div>
        </form>
      </div>
    </div>
  )
}

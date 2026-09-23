import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AuthShell } from '@/components/auth/AuthShell'
import { BufferInput } from '@/components/ui/BufferInput'
import { Segmented } from '@/components/ui/Segmented'
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
  biweekly: 'Fortnightly',
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

  const STEP_COPY: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'What should we call you?', subtitle: 'And which currency do you think in?' },
    2: { title: 'How does your pay work?', subtitle: 'Loot uses this to work out what you actually have left.' },
    3: { title: 'Set your safety buffer', subtitle: 'A share of your take-home pay that Loot never counts as spendable.' },
  }
  const netMonthly = toMonthly(netIncome)
  const bufferAmount = bufferValid ? (netMonthly * bufferNumber) / 100 : 0

  const preview = (
    <div className="space-y-4">
      <p className="text-[15px] font-semibold text-white/60">{displayName.trim() ? `${displayName.trim().split(' ')[0]}’s month` : 'Your month'}</p>
      <div className="rounded-[22px] bg-white/8 p-6">
        <p className="text-[14px] text-white/60">Take-home pay</p>
        <p className="tnum mt-1 text-[44px] leading-none font-bold tracking-[-0.04em]">
          {netMonthly > 0 ? formatCurrencyExact(netMonthly, currencyCode) : '—'}
        </p>
        <div className="mt-6 space-y-3 text-[15px]">
          <div className="flex justify-between">
            <span className="text-white/60">Safety buffer</span>
            <span className="tnum font-semibold">{netMonthly > 0 && bufferValid ? formatCurrencyExact(bufferAmount, currencyCode) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Expenses</span>
            <span className="text-white/60">Added next</span>
          </div>
        </div>
      </div>
      <p className="text-[14px] leading-relaxed text-white/50">
        Next you’ll add your recurring costs, and Loot will show what’s left to spend.
      </p>
    </div>
  )

  return (
    <AuthShell back={false} title={STEP_COPY[step].title} subtitle={STEP_COPY[step].subtitle} aside={preview}>
      <div className="mb-6 flex items-center gap-3" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-primary' : 'bg-fill-2'}`} />
          ))}
        </div>
        <span className="tnum text-[13px] font-semibold text-muted-foreground">
          {step} of {TOTAL_STEPS}
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="display-name">
                Your name
              </label>
              <input id="display-name" autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Thandi" />
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
              <span className="field-label">How often are you paid?</span>
              <Segmented
                full
                label="Pay frequency"
                value={payFrequency}
                onChange={setPayFrequency}
                options={PAY_FREQUENCIES.map((freq) => ({ value: freq, label: FREQUENCY_LABELS[freq] }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="gross-income">
                  Before tax, per {payPeriodWord[payFrequency]}
                </label>
                <input id="gross-income" type="number" inputMode="decimal" min={0} value={grossIncome} onChange={(e) => setGrossIncome(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="field-label" htmlFor="net-income">
                  Take-home, per {payPeriodWord[payFrequency]}
                </label>
                <input id="net-income" type="number" inputMode="decimal" min={0} value={netIncome} onChange={(e) => setNetIncome(e.target.value)} placeholder="0" />
              </div>
            </div>
            {payFrequency !== 'monthly' && Number(netIncome) > 0 && (
              <p className="text-[13px] text-muted-foreground">
                That’s about <span className="tnum font-semibold text-foreground">{formatCurrencyExact(netMonthly, currencyCode)}</span> a month
                take-home. Loot works in monthly figures.
              </p>
            )}
            {Number(grossIncome) > 0 && Number(netIncome) > Number(grossIncome) && (
              <p className="text-[13px] font-medium text-caution">Your take-home is higher than your pay before tax. Double-check the two numbers.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <span className="field-label">Quick picks</span>
              <div className="flex flex-wrap gap-2">
                {['10', '12.5', '15', '20'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSafetyBufferPct(v)}
                    aria-pressed={safetyBufferPct === v}
                    className={`btn !min-h-10 !px-4 !text-[14px] ${safetyBufferPct === v ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {v}%{v === '12.5' ? ' · default' : ''}
                  </button>
                ))}
              </div>
            </div>
            <BufferInput netIncome={netMonthly} pct={safetyBufferPct} onPctChange={setSafetyBufferPct} currency={currencyCode} idPrefix="safety-buffer" />
            {bufferValid && netMonthly > 0 && (
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary/10 px-4 py-3.5">
                <span className="text-[14px] font-medium">Kept aside each month</span>
                <span className="tnum shrink-0 text-[20px] font-bold tracking-[-0.02em] text-primary">
                  {formatCurrencyExact(bufferAmount, currencyCode)}
                </span>
              </div>
            )}
          </div>
        )}

        {step === 3 && !bufferValid && (
          <p role="alert" className="mt-3 text-[13px] font-medium text-alert">
            Choose a buffer between 0% and 50%.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-[13px] font-medium text-alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={goBack} className="btn btn-secondary !min-h-12 flex-1 !text-[16px]">
              Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              type="submit"
              disabled={(step === 1 && !canAdvanceFromStep1) || (step === 2 && !canAdvanceFromStep2)}
              className="btn btn-primary !min-h-12 flex-[2] !text-[16px]"
            >
              Continue
            </button>
          ) : (
            <button type="submit" disabled={updateProfile.isPending || !bufferValid} className="btn btn-primary !min-h-12 flex-[2] !text-[16px]">
              {updateProfile.isPending && <Loader2 size={16} className="animate-spin" />}
              Finish set-up
            </button>
          )}
        </div>
      </form>
    </AuthShell>
  )
}

import { Fingerprint } from 'lucide-react'
import { useDebts } from '@/hooks/useDebts'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { buildIdentity, type IdentityTone } from '@/lib/identity'
import { SettingsHeading } from '@/components/settings/SettingsHeading'

const TONE_CLASS: Record<IdentityTone, string> = {
  good: 'chip-positive',
  ok: 'chip-caution',
  bad: 'chip-alert',
}

export function FinancialIdentitySection() {
  const { data: profile } = useProfile()
  const { data: snapshots = [], isLoading } = useSnapshots(6)
  const { data: debts = [] } = useDebts()

  const debtMonthly = debts.reduce((sum, d) => sum + d.min_payment, 0)
  const gross = profile?.gross_income ?? 0
  const dtiPct = gross > 0 ? (debtMonthly / gross) * 100 : 0
  const identity = buildIdentity(snapshots, dtiPct)

  return (
    <section className="card space-y-4">
      <SettingsHeading icon={Fingerprint} title="Your money personality" color="var(--chart-6)" description="How your habits read over the last few months." />

      {isLoading ? (
        <div className="skeleton h-32 rounded-2xl" />
      ) : !identity ? (
        <p className="text-[14px] text-muted-foreground">
          Your profile fills in as Loot collects data. Add your income and expenses, and check back after your first month.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {identity.dimensions.map((d) => (
              <div key={d.label} className="rounded-2xl bg-fill p-4">
                <p className="text-[13px] font-medium text-muted-foreground">{d.label}</p>
                <p className={`chip mt-2 ${TONE_CLASS[d.tone]}`}>{d.value}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{d.explain}</p>
              </div>
            ))}
          </div>
          <p className="text-[15px] leading-relaxed">{identity.summary}</p>
          <p className="text-[12px] text-text-subtle">
            Based on {identity.months} month{identity.months === 1 ? '' : 's'} of data · updates as you use Loot
          </p>
        </>
      )}
    </section>
  )
}

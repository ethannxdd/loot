import { Fingerprint } from 'lucide-react'
import { useDebts } from '@/hooks/useDebts'
import { useProfile } from '@/hooks/useProfile'
import { useSnapshots } from '@/hooks/useSnapshots'
import { buildIdentity, type IdentityTone } from '@/lib/identity'

const TONE_CLASS: Record<IdentityTone, string> = {
  good: 'border-primary/30 bg-primary/10 text-primary',
  ok: 'border-caution/30 bg-caution/10 text-caution',
  bad: 'border-alert/30 bg-alert/10 text-alert',
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
      <div className="overline-label flex items-center gap-1.5">
        <Fingerprint size={13} strokeWidth={2} /> Your financial profile
      </div>

      {isLoading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : !identity ? (
        <p className="text-sm text-muted-foreground">
          Your profile fills in as Loot collects data. Add your income and expenses, and check back after your first month.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {identity.dimensions.map((d) => (
              <div key={d.label} className="rounded-xl border border-hairline p-4">
                <p className="overline-label">{d.label}</p>
                <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${TONE_CLASS[d.tone]}`}>{d.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.explain}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed">{identity.summary}</p>
          <p className="text-[11px] text-text-subtle">
            Based on {identity.months} month{identity.months === 1 ? '' : 's'} of data · updates as you use Loot
          </p>
        </>
      )}
    </section>
  )
}

import { Settings } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatStrip } from '@/components/ui/StatStrip'
import { formatCurrency } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { DeductionTracker } from '@/components/tax/DeductionTracker'
import { EFilingGuide } from '@/components/tax/EFilingGuide'
import { ProvisionalTaxCard } from '@/components/tax/ProvisionalTaxCard'
import { TaxCalendarCard } from '@/components/tax/TaxCalendarCard'
import { TaxEstimateCard } from '@/components/tax/TaxEstimateCard'
import { TaxGlossary } from '@/components/tax/TaxGlossary'
import { TaxSetupForm } from '@/components/tax/TaxSetupForm'
import { useExpenses } from '@/hooks/useExpenses'
import { useProfile } from '@/hooks/useProfile'
import { useTaxProfile, useUpsertTaxProfile } from '@/hooks/useTaxProfile'
import { useTaxYearData, useUpsertTaxYearData } from '@/hooks/useTaxYearData'
import { estimateTax, provisionalTaxEstimates } from '@/lib/tax/tax-math'
import { getCurrentTaxYear } from '@/lib/tax/tax-tables'
import { monthlyEquivalent } from '@/lib/money'

export function TaxPage() {
  const taxYear = getCurrentTaxYear()
  const startYear = Number(taxYear.split('/')[0])

  const { data: profile } = useProfile()
  const { data: taxProfile, isLoading: taxProfileLoading } = useTaxProfile()
  const upsertTaxProfile = useUpsertTaxProfile()

  const { data: expenses = [] } = useExpenses()
  const { data: yearData } = useTaxYearData(taxYear)
  const upsertYearData = useUpsertTaxYearData(taxYear)

  const [editingSetup, setEditingSetup] = useState(false)
  const editFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingSetup) editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editingSetup])

  if (taxProfileLoading) {
    return <div className="skeleton h-96 rounded-[22px]" />
  }

  if (!taxProfile) {
    return (
      <div className="animate-enter mx-auto max-w-lg space-y-6">
        <PageHeader
          eyebrow={`Planning · ${taxYear} tax year`}
          title="Tax centre"
          subtitle="Answer a few questions and Loot will estimate your tax, refund and deadlines."
        />
        <TaxSetupForm
          isSubmitting={upsertTaxProfile.isPending}
          onSubmit={(values) => upsertTaxProfile.mutate(values, { onSuccess: () => toast.success('Tax profile saved') })}
        />
      </div>
    )
  }

  const grossAnnualIncome = (profile?.gross_income ?? 0) * 12
  // PAYE withheld is assumed from the employment type (see estimateTax) — the schema doesn't track it.
  const estimate = yearData ? estimateTax(taxProfile, yearData, grossAnnualIncome) : null
  const workRelatedAnnual = expenses
    .filter((e) => !e.deleted_at && e.work_related)
    .reduce((sum, e) => sum + monthlyEquivalent(e) * 12, 0)

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow={`Planning · ${taxYear} tax year`}
        title="Tax centre"
        subtitle="Estimates based on SARS tables. A guide, not a tax return."
        actions={
          <button type="button" onClick={() => setEditingSetup(true)} className="btn btn-secondary">
            <Settings size={16} strokeWidth={2} /> Edit tax profile
          </button>
        }
      />

      {estimate && (
        <div data-tutorial="tax-summary"><StatStrip
          items={[
            { label: 'Tax for the year', value: formatCurrency(estimate.annualLiability) },
            { label: 'Per month', value: formatCurrency(estimate.monthlyPaye) },
            { label: 'Effective rate', value: `${estimate.effectiveRate.toFixed(1)}%`, sub: `Top bracket ${estimate.marginalRate}%` },
            {
              label: estimate.refundOrOweEstimate > 0 ? 'Likely refund' : estimate.refundOrOweEstimate < 0 ? 'Still to pay' : 'Refund or owe',
              value: formatCurrency(Math.abs(estimate.refundOrOweEstimate)),
              sub: estimate.refundOrOweEstimate === 0 ? 'Square with SARS' : 'At assessment',
              valueColor: estimate.refundOrOweEstimate > 0 ? 'var(--accent)' : estimate.refundOrOweEstimate < 0 ? 'var(--alert)' : undefined,
            },
          ]}
        /></div>
      )}

      {editingSetup && (
        <div ref={editFormRef} className="animate-enter">
          <TaxSetupForm
            initial={taxProfile}
            isSubmitting={upsertTaxProfile.isPending}
            onCancel={() => setEditingSetup(false)}
            onSubmit={(values) => upsertTaxProfile.mutate(values, { onSuccess: () => {
                setEditingSetup(false)
                toast.success('Tax profile updated')
              },
            })}
          />
        </div>
      )}

      {grossAnnualIncome <= 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !py-4">
          <p className="text-[14px] text-muted-foreground">Add your gross income so Loot can work out your tax.</p>
          <Link to="/settings" className="btn btn-ghost !min-h-9 !text-[13px]">
            Set income
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!yearData && <div className="skeleton h-64 rounded-[22px]" />}
          {estimate && <TaxEstimateCard estimate={estimate} />}
          {taxProfile.is_provisional_taxpayer === 'yes' && estimate && (
            <ProvisionalTaxCard estimates={provisionalTaxEstimates(estimate, startYear)} />
          )}
          {yearData && (
            <DeductionTracker
              yearData={yearData}
              profile={taxProfile}
              grossAnnualIncome={grossAnnualIncome}
              workRelatedAnnual={workRelatedAnnual}
              isSaving={upsertYearData.isPending}
              onSave={(patch) => upsertYearData.mutate(patch, { onSuccess: () => toast.success('Deductions saved') })}
            />
          )}
          <EFilingGuide profile={taxProfile} />
        </div>
        <div className="space-y-4">
          <TaxCalendarCard isProvisional={taxProfile.is_provisional_taxpayer === 'yes'} />
          <TaxGlossary />
        </div>
      </div>

    </div>
  )
}

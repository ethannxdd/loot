import { Settings } from 'lucide-react'
import { useState } from 'react'
import { DeductionTracker } from '@/components/tax/DeductionTracker'
import { EFilingGuide } from '@/components/tax/EFilingGuide'
import { ProvisionalTaxCard } from '@/components/tax/ProvisionalTaxCard'
import { TaxCalendarCard } from '@/components/tax/TaxCalendarCard'
import { TaxEstimateCard } from '@/components/tax/TaxEstimateCard'
import { TaxGlossary } from '@/components/tax/TaxGlossary'
import { TaxSetupForm } from '@/components/tax/TaxSetupForm'
import { Modal } from '@/components/ui/Modal'
import { useProfile } from '@/hooks/useProfile'
import { useTaxProfile, useUpsertTaxProfile } from '@/hooks/useTaxProfile'
import { useTaxYearData, useUpsertTaxYearData } from '@/hooks/useTaxYearData'
import { estimateTax, provisionalTaxEstimates } from '@/lib/tax/tax-math'
import { getCurrentTaxYear } from '@/lib/tax/tax-tables'

export function TaxPage() {
  const taxYear = getCurrentTaxYear()
  const startYear = Number(taxYear.split('/')[0])

  const { data: profile } = useProfile()
  const { data: taxProfile, isLoading: taxProfileLoading } = useTaxProfile()
  const upsertTaxProfile = useUpsertTaxProfile()

  const { data: yearData } = useTaxYearData(taxYear)
  const upsertYearData = useUpsertTaxYearData(taxYear)

  const [editingSetup, setEditingSetup] = useState(false)

  if (taxProfileLoading) {
    return <div className="skeleton h-96 rounded-2xl" />
  }

  if (!taxProfile) {
    return (
      <div className="animate-enter mx-auto max-w-lg space-y-6">
        <header className="text-center">
          <h1 className="text-[32px] font-bold tracking-[-0.025em]">Tax Centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">Let's set up your tax profile first.</p>
        </header>
        <TaxSetupForm isSubmitting={upsertTaxProfile.isPending} onSubmit={(values) => upsertTaxProfile.mutate(values)} />
      </div>
    )
  }

  const grossAnnualIncome = (profile?.gross_income ?? 0) * 12
  const paidViaPaye = taxProfile.is_provisional_taxpayer === 'no' ? 0 : 0 // no PAYE-paid tracking field in schema — left at 0 (owing = full liability)
  const estimate = yearData ? estimateTax(taxProfile, yearData, grossAnnualIncome, paidViaPaye) : null

  return (
    <div className="animate-enter space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.025em]">Tax Centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">SARS-aligned estimates for the {taxYear} tax year.</p>
        </div>
        <button type="button" onClick={() => setEditingSetup(true)} className="btn btn-ghost">
          <Settings size={15} strokeWidth={1.75} /> Edit profile
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {estimate && <TaxEstimateCard estimate={estimate} />}
          {taxProfile.is_provisional_taxpayer === 'yes' && estimate && (
            <ProvisionalTaxCard estimates={provisionalTaxEstimates(estimate, startYear)} />
          )}
          {yearData && (
            <DeductionTracker
              yearData={yearData}
              marginalRateEstimate={estimate?.effectiveRate ?? 0}
              isSaving={upsertYearData.isPending}
              onSave={(patch) => upsertYearData.mutate(patch)}
            />
          )}
          <EFilingGuide profile={taxProfile} />
        </div>
        <div className="space-y-5">
          <TaxCalendarCard />
          <TaxGlossary />
        </div>
      </div>

      {editingSetup && (
        <Modal title="Edit tax profile" onClose={() => setEditingSetup(false)}>
          <TaxSetupForm
            initial={taxProfile}
            isSubmitting={upsertTaxProfile.isPending}
            onSubmit={(values) => upsertTaxProfile.mutate(values, { onSuccess: () => setEditingSetup(false) })}
          />
        </Modal>
      )}
    </div>
  )
}

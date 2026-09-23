import { HelpCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { TaxEstimate } from '@/lib/tax/tax-math'

interface RowProps {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}

function Row({ label, value, bold, muted }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className={`text-[14px] ${bold ? 'font-semibold text-foreground' : muted ? 'text-text-subtle' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tnum text-[14.5px] ${bold ? 'font-bold text-foreground' : muted ? 'text-muted-foreground' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

export function TaxEstimateCard({ estimate }: { estimate: TaxEstimate }) {
  return (
    <div className="card sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="card-title">How your tax is worked out</h2>
        {estimate.belowThreshold && <span className="chip chip-positive">Below threshold</span>}
      </div>

      <Row label="Gross annual income" value={formatCurrency(estimate.grossAnnualIncome)} />
      <Row label="Retirement annuity deduction" value={`− ${formatCurrency(estimate.raDeduction)}`} muted />
      {estimate.donationsDeduction > 0 && (
        <Row label="Donations deduction" value={`− ${formatCurrency(estimate.donationsDeduction)}`} muted />
      )}
      {estimate.homeOfficeDeduction > 0 && (
        <Row label="Home office deduction" value={`− ${formatCurrency(estimate.homeOfficeDeduction)}`} muted />
      )}
      {estimate.travelDeduction > 0 && (
        <Row label="Travel deduction" value={`− ${formatCurrency(estimate.travelDeduction)}`} muted />
      )}
      {estimate.professionalDevelopmentDeduction > 0 && (
        <Row label="Professional development" value={`− ${formatCurrency(estimate.professionalDevelopmentDeduction)}`} muted />
      )}
      <div className="border-t border-hairline" />
      <Row label="Taxable income" value={formatCurrency(estimate.taxableIncome)} bold />
      <Row label="Gross tax (per SARS tables)" value={formatCurrency(estimate.grossTax)} />
      <Row label="Rebates" value={`− ${formatCurrency(estimate.rebates)}`} muted />
      {estimate.medicalCredit > 0 && (
        <Row label="Medical scheme fees tax credit" value={`− ${formatCurrency(estimate.medicalCredit)}`} muted />
      )}
      <div className="border-t border-hairline" />
      <Row label="Annual tax liability" value={formatCurrency(estimate.annualLiability)} bold />
      <Row label="Monthly PAYE equivalent" value={formatCurrency(estimate.monthlyPaye)} />
      <Row label="Effective tax rate" value={`${estimate.effectiveRate.toFixed(1)}%`} />
      {estimate.marginalRate > 0 && <Row label="Marginal rate (on your next rand)" value={`${estimate.marginalRate.toFixed(0)}%`} muted />}
      {estimate.payeWithheld > 0 && <Row label="PAYE assumed withheld by your employer" value={formatCurrency(estimate.payeWithheld)} muted />}

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3.5">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          {estimate.payeAssumed
            ? estimate.refundOrOweEstimate > 0
              ? 'Estimated refund from your deductions'
              : 'Estimated tax on top of PAYE'
            : 'Estimated tax to pay for the year'}
        </span>
        <span className={`tnum text-[20px] font-bold tracking-[-0.02em] ${estimate.refundOrOweEstimate > 0 ? 'text-primary' : estimate.refundOrOweEstimate < 0 ? 'text-alert' : ''}`}>
          {formatCurrency(Math.abs(estimate.refundOrOweEstimate))}
        </span>
      </div>

      <p className="flex items-start gap-1.5 pt-3 text-[12.5px] text-muted-foreground">
        <HelpCircle size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" />
        An estimate from SARS's published tax tables.
        {estimate.payeAssumed
          ? ' It assumes your payroll deducted PAYE on your full salary without the deductions tracked below, so those come back as a refund.'
          : ' No PAYE is assumed, so this is the tax you would pay yourself (through provisional tax or at assessment).'}{' '}
        It isn't a substitute for a registered tax practitioner or your actual eFiling assessment.
      </p>
    </div>
  )
}

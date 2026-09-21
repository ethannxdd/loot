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
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${muted ? 'text-text-muted' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tnum text-sm ${bold ? 'font-bold text-foreground' : ''}`}>{value}</span>
    </div>
  )
}

export function TaxEstimateCard({ estimate }: { estimate: TaxEstimate }) {
  return (
    <div className="card-elevated space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">Tax estimate — {estimate.taxYear}</h2>
        {estimate.belowThreshold && (
          <span className="overline rounded-full bg-primary/15 px-2.5 py-1 text-primary">Below threshold</span>
        )}
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

      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {estimate.refundOrOweEstimate >= 0 ? 'Estimated refund' : 'Estimated amount owing'}
        </span>
        <span className={`tnum text-base font-bold ${estimate.refundOrOweEstimate >= 0 ? 'text-primary' : 'text-alert'}`}>
          {formatCurrency(Math.abs(estimate.refundOrOweEstimate))}
        </span>
      </div>

      <p className="flex items-start gap-1.5 pt-2 text-xs text-text-subtle">
        <HelpCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        This is an estimate based on SARS's published tax tables — it isn't a substitute for advice from a
        registered tax practitioner or your actual eFiling assessment.
      </p>
    </div>
  )
}

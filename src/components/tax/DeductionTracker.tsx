import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { estimateTax } from '@/lib/tax/tax-math'
import { getTaxTable } from '@/lib/tax/tax-tables'
import { formatCurrency } from '@/lib/utils'
import type { NewTaxYearData, TaxProfile, TaxYearData } from '@/lib/types'

interface DeductionTrackerProps {
  yearData: TaxYearData
  profile: TaxProfile
  grossAnnualIncome: number
  /** Yearly total of expenses the user flagged "work-related" (monthly-equivalent × 12). */
  workRelatedAnnual?: number
  onSave: (patch: NewTaxYearData) => void
  isSaving?: boolean
}

export function DeductionTracker({ yearData, profile, grossAnnualIncome, workRelatedAnnual = 0, onSave, isSaving }: DeductionTrackerProps) {
  const [ra, setRa] = useState(yearData.ra_contributions.toString())
  const [medical, setMedical] = useState(yearData.medical_aid_contributions.toString())
  const [homeOffice, setHomeOffice] = useState(yearData.home_office_deduction.toString())
  const [travel, setTravel] = useState(yearData.travel_deduction.toString())
  const [donations, setDonations] = useState(yearData.donations.toString())
  const [profDev, setProfDev] = useState(yearData.professional_development.toString())

  useEffect(() => {
    setRa(yearData.ra_contributions.toString())
    setMedical(yearData.medical_aid_contributions.toString())
    setHomeOffice(yearData.home_office_deduction.toString())
    setTravel(yearData.travel_deduction.toString())
    setDonations(yearData.donations.toString())
    setProfDev(yearData.professional_development.toString())
  }, [yearData])

  const num = (v: string) => Math.max(0, Number(v) || 0)
  const table = getTaxTable(yearData.tax_year)
  const raCapPct = Math.min(100, (num(ra) / table.raDeductionCap) * 100)
  const canClaimProfDev = profile.employment_type === 'self_employed' || profile.employment_type === 'both'
  const homeOfficePct =
    profile.home_office_enabled === 'yes' && profile.home_total_area_m2 > 0
      ? (profile.home_office_area_m2 / profile.home_total_area_m2) * 100
      : null

  // The saving is worked out exactly (tax with the deductions vs without), using what's typed in right now.
  const estimatedSaving = useMemo(
    () =>
      estimateTax(
        profile,
        {
          ...yearData,
          ra_contributions: num(ra),
          home_office_deduction: num(homeOffice),
          travel_deduction: num(travel),
          donations: num(donations),
          professional_development: num(profDev),
        },
        grossAnnualIncome,
      ).deductionSaving,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, yearData, grossAnnualIncome, ra, homeOffice, travel, donations, profDev],
  )

  const dirty =
    num(ra) !== yearData.ra_contributions ||
    num(medical) !== yearData.medical_aid_contributions ||
    num(homeOffice) !== yearData.home_office_deduction ||
    num(travel) !== yearData.travel_deduction ||
    num(donations) !== yearData.donations ||
    num(profDev) !== yearData.professional_development

  function handleSave() {
    onSave({
      ra_contributions: num(ra),
      medical_aid_contributions: num(medical),
      home_office_deduction: num(homeOffice),
      travel_deduction: num(travel),
      donations: num(donations),
      professional_development: num(profDev),
    })
  }

  return (
    <div className="card space-y-5 sm:p-6">
      <div>
        <h3 className="card-title">Deductions</h3>
        <p className="text-[13px] text-muted-foreground">What you can claim for the {yearData.tax_year} tax year.</p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="field-label" htmlFor="ded-ra">
            Retirement annuity contributions (annual)
          </label>
          <span className="text-[12.5px] text-muted-foreground">{raCapPct.toFixed(0)}% of cap</span>
        </div>
        <input id="ded-ra" type="number" min={0} step="any" value={ra} onChange={(e) => setRa(e.target.value)} />
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill">
          <div className="h-full rounded-full bg-primary" style={{ width: `${raCapPct}%` }} />
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Cap: {formatCurrency(table.raDeductionCap)} or 27.5% of income, whichever is lower.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="ded-medical">
            Medical aid contributions
          </label>
          <input id="ded-medical" type="number" min={0} step="any" value={medical} onChange={(e) => setMedical(e.target.value)} />
          <p className="mt-1 text-[12.5px] text-muted-foreground">For your records — the tax credit is worked out from your dependants.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="ded-donations">
            Donations to PBOs
          </label>
          <input id="ded-donations" type="number" min={0} step="any" value={donations} onChange={(e) => setDonations(e.target.value)} />
          <p className="mt-1 text-[12.5px] text-muted-foreground">Section 18A receipts only; capped at 10% of taxable income.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="ded-home">
            Home office deduction
          </label>
          <input
            id="ded-home"
            type="number"
            min={0}
            step="any"
            value={homeOffice}
            disabled={profile.home_office_enabled !== 'yes'}
            onChange={(e) => setHomeOffice(e.target.value)}
          />
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {profile.home_office_enabled !== 'yes'
              ? 'Turn on “home office” in your tax profile to use this.'
              : homeOfficePct !== null
                ? `Your office is ${homeOfficePct.toFixed(0)}% of your home.`
                : 'Add your office and home area in your tax profile.'}
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="ded-travel">
            Travel deduction
          </label>
          <input
            id="ded-travel"
            type="number"
            min={0}
            step="any"
            value={travel}
            disabled={!profile.has_travel_allowance}
            onChange={(e) => setTravel(e.target.value)}
          />
          {!profile.has_travel_allowance && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">Only for people with a travel allowance — see your tax profile.</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor="ded-profdev">
            Professional development / CPD costs
          </label>
          <input
            id="ded-profdev"
            type="number"
            min={0}
            step="any"
            value={profDev}
            onChange={(e) => setProfDev(e.target.value)}
          />
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {canClaimProfDev
              ? 'Counted against your self-employed income.'
              : 'Salaried employees generally can’t deduct these — kept here for your records only.'}
          </p>
          {workRelatedAnnual > 0 && (
            <button
              type="button"
              onClick={() => setProfDev(String(Math.round(workRelatedAnnual)))}
              className="mt-2 text-[13px] font-semibold text-primary"
            >
              Your work-related expenses come to about {formatCurrency(workRelatedAnnual)} a year — use this
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary/10 px-4 py-3.5">
        <span className="text-[14px] font-semibold">Tax saved by your deductions</span>
        <span className="tnum shrink-0 text-[20px] font-bold tracking-[-0.02em] text-primary">{formatCurrency(estimatedSaving)}</span>
      </div>

      <button type="button" onClick={handleSave} disabled={isSaving || !dirty} className="btn btn-primary w-full">
        {isSaving && <Loader2 size={16} className="animate-spin" />}
        {dirty ? 'Save deductions' : 'Saved'}
      </button>
    </div>
  )
}

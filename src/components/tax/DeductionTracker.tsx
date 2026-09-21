import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getTaxTable } from '@/lib/tax/tax-tables'
import { formatCurrency } from '@/lib/utils'
import type { NewTaxYearData, TaxYearData } from '@/lib/types'

interface DeductionTrackerProps {
  yearData: TaxYearData
  marginalRateEstimate: number
  onSave: (patch: NewTaxYearData) => void
  isSaving?: boolean
}

export function DeductionTracker({ yearData, marginalRateEstimate, onSave, isSaving }: DeductionTrackerProps) {
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

  const table = getTaxTable(yearData.tax_year)
  const raCapPct = raCapProgress(Number(ra) || 0, table.raDeductionCap)
  const deductibleTotal =
    (Number(ra) || 0) + (Number(homeOffice) || 0) + (Number(travel) || 0) + (Number(donations) || 0) + (Number(profDev) || 0)
  const estimatedSaving = deductibleTotal * (marginalRateEstimate / 100)

  function raCapProgress(value: number, cap: number) {
    return Math.min(100, (value / cap) * 100)
  }

  function handleSave() {
    onSave({
      ra_contributions: Number(ra) || 0,
      medical_aid_contributions: Number(medical) || 0,
      home_office_deduction: Number(homeOffice) || 0,
      travel_deduction: Number(travel) || 0,
      donations: Number(donations) || 0,
      professional_development: Number(profDev) || 0,
    })
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-base font-bold">Deduction tracker — {yearData.tax_year}</h3>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="field-label" htmlFor="ded-ra">
            Retirement annuity contributions (annual)
          </label>
          <span className="text-xs text-text-muted">{raCapPct.toFixed(0)}% of cap</span>
        </div>
        <input id="ded-ra" type="number" min={0} value={ra} onChange={(e) => setRa(e.target.value)} />
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${raCapPct}%` }} />
        </div>
        <p className="mt-1 text-xs text-text-subtle">Cap: {formatCurrency(table.raDeductionCap)} or 27.5% of income, whichever is lower.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="ded-medical">
            Medical aid contributions
          </label>
          <input id="ded-medical" type="number" min={0} value={medical} onChange={(e) => setMedical(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="ded-donations">
            Donations to PBOs
          </label>
          <input id="ded-donations" type="number" min={0} value={donations} onChange={(e) => setDonations(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="ded-home">
            Home office deduction
          </label>
          <input id="ded-home" type="number" min={0} value={homeOffice} onChange={(e) => setHomeOffice(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="ded-travel">
            Travel deduction
          </label>
          <input id="ded-travel" type="number" min={0} value={travel} onChange={(e) => setTravel(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor="ded-profdev">
            Professional development / CPD costs
          </label>
          <input id="ded-profdev" type="number" min={0} value={profDev} onChange={(e) => setProfDev(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-3">
        <span className="text-sm font-semibold">Estimated tax saving from deductions</span>
        <span className="tnum text-base font-bold text-primary">{formatCurrency(estimatedSaving)}</span>
      </div>

      <button type="button" onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full">
        {isSaving && <Loader2 size={16} className="animate-spin" />}
        Save deductions
      </button>
    </div>
  )
}

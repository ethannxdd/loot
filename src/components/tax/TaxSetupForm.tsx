import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Select } from '@/components/ui/Select'
import { SwitchRow } from '@/components/ui/Switch'
import { EMPLOYMENT_TYPES, type EmploymentType, type NewTaxProfile, type TaxProfile } from '@/lib/types'

interface TaxSetupFormProps {
  initial?: TaxProfile | null
  isSubmitting?: boolean
  onSubmit: (values: NewTaxProfile) => void
  onCancel?: () => void
}

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  salaried: 'Salaried employee',
  self_employed: 'Self-employed / freelance',
  both: 'Both salaried and self-employed',
  retired: 'Retired',
  other: 'Other',
}

export function TaxSetupForm({ initial, isSubmitting, onSubmit, onCancel }: TaxSetupFormProps) {
  const [age, setAge] = useState(initial?.age?.toString() ?? '30')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(initial?.employment_type ?? 'salaried')
  const [isProvisional, setIsProvisional] = useState(initial?.is_provisional_taxpayer === 'yes')
  const [homeOfficeEnabled, setHomeOfficeEnabled] = useState(initial?.home_office_enabled === 'yes')
  const [homeOfficeArea, setHomeOfficeArea] = useState(initial?.home_office_area_m2?.toString() ?? '')
  const [homeTotalArea, setHomeTotalArea] = useState(initial?.home_total_area_m2?.toString() ?? '')
  const [hasTravelAllowance, setHasTravelAllowance] = useState(initial?.has_travel_allowance ?? false)
  const [hasRa, setHasRa] = useState(initial?.has_ra ?? false)
  const [hasInvestmentIncome, setHasInvestmentIncome] = useState(initial?.has_investment_income ?? false)
  const [hasMedicalAid, setHasMedicalAid] = useState(initial?.has_medical_aid ?? false)
  const [medicalDependants, setMedicalDependants] = useState(initial?.medical_dependants?.toString() ?? '0')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      age: Math.min(120, Math.max(16, Math.round(Number(age)) || 30)),
      employment_type: employmentType,
      is_provisional_taxpayer: isProvisional ? 'yes' : 'no',
      home_office_enabled: homeOfficeEnabled ? 'yes' : 'no',
      home_office_area_m2: Math.max(0, Number(homeOfficeArea) || 0),
      home_total_area_m2: Math.max(0, Number(homeTotalArea) || 0),
      has_travel_allowance: hasTravelAllowance,
      has_ra: hasRa,
      has_investment_income: hasInvestmentIncome,
      has_medical_aid: hasMedicalAid,
      medical_dependants: Math.min(20, Math.max(0, Math.round(Number(medicalDependants)) || 0)),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated space-y-5 sm:p-6">
      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">Your tax profile</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          A few questions so Loot can estimate your tax accurately. You can update this any time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="tax-age">
            Age
          </label>
          <input id="tax-age" type="number" min={16} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="tax-employment">
            Employment type
          </label>
          <Select
            id="tax-employment"
            value={employmentType}
            onValueChange={(v) => setEmploymentType(v as EmploymentType)}
            options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_LABELS[t] }))}
          />
        </div>
      </div>

      <div className="divide-y divide-hairline rounded-xl bg-surface-2 px-4">
        <div className="py-2">
          <SwitchRow
            label="Provisional taxpayer"
            hint="Freelance, rental or investment income not covered by PAYE"
            checked={isProvisional}
            onChange={setIsProvisional}
          />
        </div>
        <div className="py-2">
          <SwitchRow label="I contribute to a retirement annuity" checked={hasRa} onChange={setHasRa} />
        </div>
        <div className="py-2">
          <SwitchRow
            label="Investment income"
            hint="Interest, dividends or capital gains"
            checked={hasInvestmentIncome}
            onChange={setHasInvestmentIncome}
          />
        </div>
        <div className="py-2">
          <SwitchRow label="I receive a travel allowance" checked={hasTravelAllowance} onChange={setHasTravelAllowance} />
        </div>
        <div className="py-2">
          <SwitchRow
            label="Dedicated home office"
            hint="You regularly work from a room used only for work"
            checked={homeOfficeEnabled}
            onChange={setHomeOfficeEnabled}
          />
          {homeOfficeEnabled && (
            <div className="grid grid-cols-2 gap-3 pt-2 pb-2">
              <div>
                <label className="field-label" htmlFor="home-office-area">
                  Office area (m²)
                </label>
                <input id="home-office-area" type="number" min={0} value={homeOfficeArea} onChange={(e) => setHomeOfficeArea(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="home-total-area">
                  Home total area (m²)
                </label>
                <input id="home-total-area" type="number" min={0} value={homeTotalArea} onChange={(e) => setHomeTotalArea(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <div className="py-2">
          <SwitchRow label="I belong to a medical aid" checked={hasMedicalAid} onChange={setHasMedicalAid} />
        {hasMedicalAid && (
          <div className="pt-2 pb-2">
            <label className="field-label" htmlFor="medical-dependants">
              Dependants on the scheme (excluding yourself)
            </label>
            <input
              id="medical-dependants"
              type="number"
              min={0}
              value={medicalDependants}
              onChange={(e) => setMedicalDependants(e.target.value)}
              className="max-w-[120px]"
            />
          </div>
        )}
        </div>
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {initial ? 'Save changes' : 'Continue'}
        </button>
      </div>
    </form>
  )
}

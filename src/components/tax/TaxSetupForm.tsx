import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { EMPLOYMENT_TYPES, type EmploymentType, type NewTaxProfile, type TaxProfile } from '@/lib/types'

interface TaxSetupFormProps {
  initial?: TaxProfile | null
  isSubmitting?: boolean
  onSubmit: (values: NewTaxProfile) => void
}

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  salaried: 'Salaried employee',
  self_employed: 'Self-employed / freelance',
  both: 'Both salaried and self-employed',
  retired: 'Retired',
  other: 'Other',
}

export function TaxSetupForm({ initial, isSubmitting, onSubmit }: TaxSetupFormProps) {
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
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-bold">Tax profile setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
          <select id="tax-employment" value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isProvisional} onChange={(e) => setIsProvisional(e.target.checked)} className="h-4 w-4 accent-primary" style={{ width: 'auto' }} />
        I'm a provisional taxpayer (freelance/rental/investment income not covered by PAYE)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasRa} onChange={(e) => setHasRa(e.target.checked)} className="h-4 w-4 accent-primary" style={{ width: 'auto' }} />
        I contribute to a retirement annuity
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasInvestmentIncome} onChange={(e) => setHasInvestmentIncome(e.target.checked)} className="h-4 w-4 accent-primary" style={{ width: 'auto' }} />
        I have investment income (interest, dividends, capital gains)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasTravelAllowance} onChange={(e) => setHasTravelAllowance(e.target.checked)} className="h-4 w-4 accent-primary" style={{ width: 'auto' }} />
        I receive a travel allowance
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={homeOfficeEnabled} onChange={(e) => setHomeOfficeEnabled(e.target.checked)} className="h-4 w-4 accent-primary" style={{ width: 'auto' }} />
          I regularly work from a dedicated home office
        </label>
        {homeOfficeEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-6">
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

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasMedicalAid} onChange={(e) => setHasMedicalAid(e.target.checked)} className="h-4 w-4 accent-primary" style={{ width: 'auto' }} />
          I belong to a medical aid / medical scheme
        </label>
        {hasMedicalAid && (
          <div className="pl-6">
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

      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
        {initial ? 'Save changes' : 'Continue'}
      </button>
    </form>
  )
}

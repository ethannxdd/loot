import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Check, Copy, Download, FileDown, Loader2, Save, Send } from 'lucide-react'
import { computePhase, peakPhaseIndex, sarsRateForNet } from '@/lib/planner-math'
import { formatCurrency } from '@/lib/utils'
import type { PlannerPhase } from '@/lib/types'

interface PlanTargetPanelProps {
  phases: PlannerPhase[]
  activeIndex: number
  taxRate: string
  onTaxRateChange: (value: string) => void
  onSelectPhase: (index: number) => void
  /** The user's current take-home / gross (profile) — 0 when not set. */
  currentNet: number
  currentGross: number
  isNew: boolean
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
  onSaveAsNew: () => void
  onApply: () => void
  onExport: (format: 'png' | 'pdf') => void
}

function Row({ label, value, strong, accent, muted }: { label: string; value: string; strong?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className={`text-[14px] ${muted ? 'text-text-subtle' : 'text-muted-foreground'}`}>{label}</span>
      <span
        className={`tnum text-right font-semibold ${strong ? 'text-[20px] tracking-[-0.02em]' : 'text-[15px]'} ${
          accent ? 'text-primary' : muted ? 'text-muted-foreground' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

/** "Your target" — what the active phase needs you to earn, compared with what you earn now. */
export function PlanTargetPanel({
  phases,
  activeIndex,
  taxRate,
  onTaxRateChange,
  onSelectPhase,
  currentNet,
  currentGross,
  isNew,
  isDirty,
  isSaving,
  onSave,
  onSaveAsNew,
  onApply,
  onExport,
}: PlanTargetPanelProps) {
  const rate = Number(taxRate) || 0
  const phase = phases[activeIndex]
  const c = computePhase(phase, rate)
  const sarsRate = c.requiredNet > 0 ? sarsRateForNet(c.requiredNet) : null
  const rateMatches = sarsRate !== null && Math.abs(sarsRate - rate) < 0.5
  const peak = phases.length > 1 ? peakPhaseIndex(phases, rate) : -1
  const itemCount = phase.expenses.filter((e) => e.name.trim() && e.amount > 0).length

  // Compare against the salary being tested in this phase, else against what the user takes home today.
  let verdict: { tone: 'good' | 'short'; text: ReactNode } | null = null
  if (c.requiredNet > 0) {
    if (c.hasSalary) {
      const diff = c.netIncome - c.requiredNet
      verdict =
        diff >= 0
          ? {
              tone: 'good',
              text: (
                <>
                  The {formatCurrency(phase.gross_income)} salary you&apos;re testing takes home {formatCurrency(c.netIncome)} — that
                  covers this with <b className="tnum">{formatCurrency(diff)}/mo</b> to spare.
                </>
              ),
            }
          : {
              tone: 'short',
              text: (
                <>
                  The {formatCurrency(phase.gross_income)} salary you&apos;re testing falls{' '}
                  <b className="tnum">{formatCurrency(-diff)}/mo</b> short of this phase.
                </>
              ),
            }
    } else if (currentNet > 0) {
      const diff = currentNet - c.requiredNet
      verdict =
        diff >= 0
          ? {
              tone: 'good',
              text: (
                <>
                  Your current take-home already covers this by <b className="tnum">{formatCurrency(diff)}/mo</b>.
                </>
              ),
            }
          : {
              tone: 'short',
              text: (
                <>
                  You&apos;re <b className="tnum">{formatCurrency(-diff)}/mo</b> short on take-home
                  {currentGross > 0 && c.requiredGross > currentGross ? (
                    <>
                      {' '}
                      — about <b className="tnum">{formatCurrency(c.requiredGross - currentGross)}</b> more gross a month than you earn now
                    </>
                  ) : null}
                  .
                </>
              ),
            }
    }
  }

  return (
    <section className="card-elevated space-y-4 sm:p-6" aria-label="Your target" data-testid="plan-target">
      <div>
        <p className="overline-label">Your target</p>
        <p className="mt-0.5 truncate text-[15px] font-semibold">{phase.name || `Phase ${activeIndex + 1}`}</p>
      </div>

      <div>
        <label className="field-label" htmlFor="plan-tax-rate">
          Effective tax rate
        </label>
        <div className="relative">
          <input
            id="plan-tax-rate"
            type="number"
            inputMode="decimal"
            min={0}
            max={60}
            step="any"
            value={taxRate}
            onChange={(e) => onTaxRateChange(e.target.value)}
            className="!pr-10"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">%</span>
        </div>
        {sarsRate !== null &&
          (rateMatches ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Check size={14} strokeWidth={2.4} className="text-primary" /> Matches SARS tables for this salary
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onTaxRateChange(String(sarsRate))}
              className="mt-2 text-left text-[13px] font-semibold text-primary"
            >
              SARS tables put this salary at {sarsRate}% — use {sarsRate}%
            </button>
          ))}
      </div>

      <div className="divide-y divide-hairline border-y border-hairline">
        <Row label="Monthly expenses" value={formatCurrency(c.totalExpenses)} />
        <Row label="+ Leftover target" value={formatCurrency(c.leftoverTarget)} />
        <Row label="Take-home needed / month" value={formatCurrency(c.requiredNet)} strong />
        <Row label="Gross salary needed / month" value={formatCurrency(c.requiredGross)} strong accent />
        <Row label="Annual gross" value={formatCurrency(c.requiredAnnualGross)} muted />
      </div>

      {c.upfront > 0 && (
        <p className="rounded-xl bg-fill px-3.5 py-3 text-[13px] text-muted-foreground">
          Plus <b className="tnum text-foreground">{formatCurrency(c.upfront)}</b> in once-off costs up front. Set how long this phase
          lasts to spread them across it.
        </p>
      )}

      {verdict ? (
        <p
          data-testid="plan-verdict"
          className={`rounded-xl px-3.5 py-3 text-[14px] leading-relaxed ${
            verdict.tone === 'good' ? 'bg-[var(--accent-tint)] text-primary' : 'bg-[color-mix(in_srgb,var(--caution)_14%,transparent)] text-caution'
          }`}
        >
          {verdict.text}
        </p>
      ) : c.requiredNet > 0 && currentNet <= 0 ? (
        <p className="rounded-xl bg-fill px-3.5 py-3 text-[13px] text-muted-foreground">
          <Link to="/settings" className="font-semibold text-primary">
            Add your income
          </Link>{' '}
          to see how this compares with what you earn now.
        </p>
      ) : null}

      {phases.length > 1 && (
        <div>
          <p className="field-label">Every phase</p>
          <div className="divide-y divide-hairline rounded-xl bg-surface-2 px-3.5">
            {phases.map((p, i) => {
              const pc = computePhase(p, rate)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectPhase(i)}
                  className={`flex w-full items-center justify-between gap-3 py-2.5 text-left text-[14px] ${i === activeIndex ? 'font-semibold' : ''}`}
                >
                  <span className="min-w-0 truncate">
                    {p.name || `Phase ${i + 1}`}
                    {i === peak && pc.requiredGross > 0 && <span className="chip chip-positive ml-2 !h-5 !px-2 !text-[11px]">Highest</span>}
                  </span>
                  <span className="tnum shrink-0">
                    {formatCurrency(pc.requiredGross)}
                    <span className="text-muted-foreground"> gross</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || (!isNew && !isDirty)}
          className="btn btn-primary"
          data-testid="plan-save"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={2} />}
          {isNew ? 'Save plan' : isDirty ? 'Save' : 'Saved'}
        </button>
        <button type="button" onClick={onSaveAsNew} disabled={isSaving || isNew} className="btn btn-secondary">
          <Copy size={15} strokeWidth={2} /> Save as new
        </button>
        <button type="button" onClick={onApply} disabled={itemCount === 0} className="btn btn-secondary col-span-2" data-testid="plan-apply">
          <Send size={15} strokeWidth={2} /> Apply {phases.length > 1 ? `“${phase.name || `Phase ${activeIndex + 1}`}”` : 'plan'} to expenses
        </button>
        <button type="button" onClick={() => onExport('pdf')} className="btn btn-ghost">
          <FileDown size={15} strokeWidth={2} /> PDF
        </button>
        <button type="button" onClick={() => onExport('png')} className="btn btn-ghost">
          <Download size={15} strokeWidth={2} /> Image
        </button>
      </div>

      <p className="text-[12.5px] leading-relaxed text-text-subtle">
        Rough estimate at a flat effective rate — real payroll deductions vary with UIF, pension, medical aid and bracket edges.
      </p>
    </section>
  )
}

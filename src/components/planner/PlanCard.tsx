import { ChevronRight, Download, FileDown, Trash2 } from 'lucide-react'
import { PlanExportDoc } from '@/components/export/ExportDocs'
import { exportDocument } from '@/lib/export'
import { computePhase, peakPhaseIndex } from '@/lib/planner-math'
import { formatCurrency } from '@/lib/utils'
import type { PlannerPlan } from '@/lib/types'

interface PlanCardProps {
  plan: PlannerPlan
  /** The user's current take-home, for the export's comparison line. */
  currentNet: number
  onOpen: () => void
  onDelete: () => void
}

export function PlanCard({ plan, currentNet, onOpen, onDelete }: PlanCardProps) {
  const computed = plan.phases.map((phase) => computePhase(phase, plan.tax_rate_pct))
  const peak = peakPhaseIndex(plan.phases, plan.tax_rate_pct)
  const top = peak >= 0 ? computed[peak] : null
  const single = plan.phases.length === 1
  const iconBtn = 'grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill'

  return (
    <div className="card flex flex-col gap-4 sm:p-6" data-testid="plan-card">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <h3 className="truncate text-[18px] font-bold tracking-[-0.015em]">{plan.name}</h3>
          <p className="text-[13px] text-muted-foreground">
            {plan.phases.length} phase{plan.phases.length !== 1 ? 's' : ''} · {plan.tax_rate_pct}% effective tax
          </p>
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${plan.name}`} className={`${iconBtn} -mr-2 hover:text-alert`}>
          <Trash2 size={15} strokeWidth={1.9} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="text-left">
        <p className="text-[13px] text-muted-foreground">{single ? 'Salary needed' : 'Salary needed at its highest'}</p>
        <p className="tnum text-[34px] font-bold leading-tight tracking-[-0.035em]">
          {formatCurrency(top?.requiredGross ?? 0)}
          <span className="text-[15px] font-semibold tracking-normal text-muted-foreground"> gross / mo</span>
        </p>
        <p className="tnum text-[13px] text-muted-foreground">
          {formatCurrency(top?.requiredNet ?? 0)} take-home
          {!single && peak >= 0 ? ` · in ${plan.phases[peak].name}` : ''}
        </p>
      </button>

      <button type="button" onClick={onOpen} className="divide-y divide-hairline rounded-2xl bg-surface-2 px-4 text-left">
        {plan.phases.map((phase, i) => {
          const c = computed[i]
          return (
            <div key={i} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold">{phase.name}</p>
                <p className="tnum text-[12.5px] text-muted-foreground">
                  {formatCurrency(c.totalExpenses)} spend · {formatCurrency(c.leftoverTarget)} to keep
                </p>
              </div>
              <span className="tnum shrink-0 text-[14.5px] font-semibold text-primary">{formatCurrency(c.requiredGross)}</span>
            </div>
          )
        })}
      </button>

      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => exportDocument(<PlanExportDoc plan={plan} currentNet={currentNet} />, `${plan.name}-plan`, 'png')}
          className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]"
        >
          <Download size={14} strokeWidth={2} /> Image
        </button>
        <button
          type="button"
          onClick={() => exportDocument(<PlanExportDoc plan={plan} currentNet={currentNet} />, `${plan.name}-plan`, 'pdf')}
          className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]"
        >
          <FileDown size={14} strokeWidth={2} /> PDF
        </button>
        <button type="button" onClick={onOpen} className="btn btn-secondary ml-auto !min-h-9 !px-3.5 !text-[13px]">
          Open <ChevronRight size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

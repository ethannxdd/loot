import { Download, FileDown, Pencil, Trash2 } from 'lucide-react'
import { computePhase } from '@/lib/planner-math'
import { formatCurrency } from '@/lib/utils'
import { PlanExportDoc } from '@/components/export/ExportDocs'
import { exportDocument } from '@/lib/export'
import type { PlannerPlan } from '@/lib/types'

interface PlanCardProps {
  plan: PlannerPlan
  onEdit: () => void
  onDelete: () => void
}

export function PlanCard({ plan, onEdit, onDelete }: PlanCardProps) {
  const totals = plan.phases.map((phase) => computePhase(phase, plan.tax_rate_pct))
  const totalLeftover = totals.reduce((sum, t) => sum + t.leftover, 0)
  const single = plan.phases.length === 1
  const iconBtn = 'grid h-9 w-9 place-items-center rounded-full text-text-subtle hover:bg-fill'

  return (
    <div className="card flex flex-col gap-4 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[18px] font-bold tracking-[-0.015em]">{plan.name}</h3>
          <p className="text-[13px] text-muted-foreground">
            {plan.phases.length} phase{plan.phases.length !== 1 ? 's' : ''} · {plan.tax_rate_pct}% effective tax
          </p>
        </div>
        <div className="-mr-2 flex" data-export-ignore>
          <button type="button" onClick={onEdit} aria-label="Edit plan" className={`${iconBtn} hover:text-foreground`}>
            <Pencil size={15} strokeWidth={1.9} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete plan" className={`${iconBtn} hover:text-alert`}>
            <Trash2 size={15} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div>
        <p className="text-[13px] text-muted-foreground">{single ? 'Left over each month' : 'Left over across all phases'}</p>
        <p
          className={`tnum text-[34px] font-bold leading-tight tracking-[-0.035em] ${totalLeftover < 0 ? 'text-alert' : ''}`}
        >
          {formatCurrency(totalLeftover)}
        </p>
      </div>

      <div className="divide-y divide-hairline rounded-2xl bg-surface-2 px-4">
        {plan.phases.map((phase, i) => {
          const computed = totals[i]
          return (
            <div key={i} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold">{phase.name}</p>
                <p className="tnum text-[12.5px] text-muted-foreground">
                  {formatCurrency(computed.netIncome)} net · {formatCurrency(computed.totalExpenses)} out
                </p>
              </div>
              <span className={`tnum shrink-0 text-[14.5px] font-semibold ${computed.leftover < 0 ? 'text-alert' : 'text-primary'}`}>
                {formatCurrency(computed.leftover)}/mo
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-auto flex gap-2" data-export-ignore>
        <button type="button" onClick={() => exportDocument(<PlanExportDoc plan={plan} />, `${plan.name}-plan`, 'png')} className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]">
          <Download size={14} strokeWidth={2} /> Image
        </button>
        <button type="button" onClick={() => exportDocument(<PlanExportDoc plan={plan} />, `${plan.name}-plan`, 'pdf')} className="btn btn-ghost !min-h-9 !px-3.5 !text-[13px]">
          <FileDown size={14} strokeWidth={2} /> PDF
        </button>
      </div>
    </div>
  )
}

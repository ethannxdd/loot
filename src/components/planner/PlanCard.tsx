import { Download, FileDown, Pencil, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { computePhase } from '@/lib/planner-math'
import { formatCurrency } from '@/lib/utils'
import { exportElementAsPdf, exportElementAsPng } from '@/lib/export'
import type { PlannerPlan } from '@/lib/types'

interface PlanCardProps {
  plan: PlannerPlan
  onEdit: () => void
  onDelete: () => void
}

export function PlanCard({ plan, onEdit, onDelete }: PlanCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const totals = plan.phases.map((phase) => computePhase(phase, plan.tax_rate_pct))
  const totalLeftover = totals.reduce((sum, t) => sum + t.leftover, 0)

  return (
    <div ref={ref} className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">
            {plan.phases.length} phase{plan.phases.length !== 1 ? 's' : ''} · {plan.tax_rate_pct}% effective tax
          </p>
        </div>
        <div className="flex gap-1" data-export-ignore>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit plan"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-foreground"
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete plan"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {plan.phases.map((phase, i) => {
          const computed = totals[i]
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
            >
              <span className="font-semibold">{phase.name}</span>
              <span className={`tnum ${computed.leftover < 0 ? 'text-alert' : 'text-primary'}`}>
                {formatCurrency(computed.leftover)}/mo left
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-hairline pt-3">
        <div>
          <p className="overline">Total leftover</p>
          <p className={`tnum text-lg ${totalLeftover < 0 ? 'text-alert' : 'text-primary'}`}>
            {formatCurrency(totalLeftover)}
          </p>
        </div>
        <div className="flex gap-2" data-export-ignore>
          <button
            type="button"
            onClick={() => ref.current && exportElementAsPng(ref.current, `${plan.name}-plan`)}
            className="btn btn-ghost !px-3"
          >
            <Download size={14} strokeWidth={1.75} /> PNG
          </button>
          <button
            type="button"
            onClick={() => ref.current && exportElementAsPdf(ref.current, `${plan.name}-plan`)}
            className="btn btn-ghost !px-3"
          >
            <FileDown size={14} strokeWidth={1.75} /> PDF
          </button>
        </div>
      </div>
    </div>
  )
}

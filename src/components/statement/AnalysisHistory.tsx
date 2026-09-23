import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useDeleteStatementAnalysis } from '@/hooks/useStatementAnalyses'
import { monthLabel } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { StatementAnalysis } from '@/lib/types'

interface AnalysisHistoryProps {
  analyses: StatementAnalysis[]
}

export function AnalysisHistory({ analyses }: AnalysisHistoryProps) {
  const remove = useDeleteStatementAnalysis()
  const [target, setTarget] = useState<StatementAnalysis | null>(null)

  if (analyses.length === 0) return null

  const label = (a: StatementAnalysis) => (a.statement_month ? monthLabel(`${a.statement_month}-01`) : 'Statement')

  return (
    <div className="card !pb-2">
      <h3 className="card-title mb-1">Saved analyses</h3>
      <div className="divide-y divide-hairline">
      {analyses.map((a) => (
        <div key={a.id} className="flex items-center gap-3 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-fill text-[10px] font-bold uppercase text-muted-foreground">
            {a.bank === 'fnb' ? 'FNB' : 'CAP'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{label(a)}</p>
            <p className="text-[12.5px] text-muted-foreground">Saved {new Date(a.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="text-right">
            <p className="tnum text-[15px] font-semibold">{formatCurrency(a.total_spent)} spent</p>
            <p className="tnum text-[12.5px] text-muted-foreground">{formatCurrency(a.total_income)} in</p>
          </div>
          <button
            type="button"
            onClick={() => setTarget(a)}
            aria-label={`Delete ${label(a)} analysis`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      ))}
      </div>

      {target && (
        <ConfirmModal
          title="Delete this analysis?"
          confirmLabel="Delete"
          isPending={remove.isPending}
          onCancel={() => setTarget(null)}
          onConfirm={() =>
            remove.mutate(target.id, {
              onSuccess: () => {
                setTarget(null)
                toast.success('Analysis deleted')
              },
            })
          }
        >
          <p>
            The saved {label(target)} analysis will be removed from your history. It won't affect your expenses, and you
            can always upload the statement again.
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}

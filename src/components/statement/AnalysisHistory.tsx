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
    <div className="card space-y-2">
      <p className="overline-label">Analysis history</p>
      {analyses.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {label(a)} <span className="ml-1 text-xs font-normal uppercase text-text-muted">{a.bank}</span>
            </p>
            <p className="text-xs text-muted-foreground">Saved {new Date(a.created_at).toLocaleDateString('en-ZA')}</p>
          </div>
          <div className="text-right">
            <p className="tnum">{formatCurrency(a.total_spent)} spent</p>
            <p className="tnum text-xs text-muted-foreground">{formatCurrency(a.total_income)} in</p>
          </div>
          <button
            type="button"
            onClick={() => setTarget(a)}
            aria-label={`Delete ${label(a)} analysis`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/10 hover:text-alert"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      ))}

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

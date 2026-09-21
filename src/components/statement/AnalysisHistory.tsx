import { formatCurrency } from '@/lib/utils'
import type { StatementAnalysis } from '@/lib/types'

interface AnalysisHistoryProps {
  analyses: StatementAnalysis[]
}

export function AnalysisHistory({ analyses }: AnalysisHistoryProps) {
  if (analyses.length === 0) return null

  return (
    <div className="card space-y-2">
      <p className="overline">Analysis history</p>
      {analyses.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
          <div>
            <p className="font-semibold uppercase">{a.bank}</p>
            <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('en-ZA')}</p>
          </div>
          <div className="text-right">
            <p className="tnum">{formatCurrency(a.total_spent)} spent</p>
            <p className="text-xs text-muted-foreground tnum">{formatCurrency(a.total_income)} in</p>
          </div>
        </div>
      ))}
    </div>
  )
}

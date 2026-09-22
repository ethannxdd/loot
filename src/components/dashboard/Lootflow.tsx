import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { HealthLevel } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'

interface LootflowProps {
  netIncome: number
  totalExpenses: number
  deltaVsLastMonth: number | null
  health: HealthLevel
}

const HEALTH_META: Record<HealthLevel, { label: string; className: string }> = {
  comfortable: { label: 'Comfortable', className: 'text-primary bg-primary/10 border-primary/30' },
  balanced: { label: 'Balanced', className: 'text-caution bg-caution/10 border-caution/30' },
  tight: { label: 'Tight', className: 'text-alert bg-alert/10 border-alert/30' },
}

export function Lootflow({ netIncome, totalExpenses, deltaVsLastMonth, health }: LootflowProps) {
  const net = netIncome - totalExpenses
  const data = [
    { name: 'Income', value: Math.max(0, netIncome) },
    { name: 'Expenses', value: Math.max(0, totalExpenses) },
  ]
  const meta = HEALTH_META[health]

  return (
    <div className="card space-y-4">
      <div className="overline-label">Lootflow</div>
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={38}
                outerRadius={54}
                paddingAngle={3}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#C1FE72" />
                <Cell fill="#AF72FE" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-sm font-bold">{formatCurrency(net)}</span>
            <span className="text-[9px] text-text-muted">net</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span className="text-muted-foreground">Income</span>
            <span className="tnum ml-auto font-semibold">{formatCurrency(netIncome)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full bg-secondary" />
            <span className="text-muted-foreground">Expenses</span>
            <span className="tnum ml-auto font-semibold">{formatCurrency(totalExpenses)}</span>
          </div>
          {deltaVsLastMonth !== null && (
            <p className="text-[11px] text-text-muted">
              {deltaVsLastMonth >= 0 ? '+' : ''}
              {formatCurrency(deltaVsLastMonth)} vs last month
            </p>
          )}
          <span className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  )
}

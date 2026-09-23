import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { habitsRating } from '@/lib/loot-score'
import { monthLabel } from '@/lib/money'
import type { BudgeScore } from '@/lib/types'

/** Money-habits rating (0–100) month by month. Bureau scores live on their own scales, so they aren't mixed in. */
export function ScoreTimelineChart({ history }: { history: BudgeScore[] }) {
  if (history.length < 2) return null
  const data = history.map((h) => ({ label: monthLabel(h.month), rating: habitsRating(h.score) }))
  return (
    <div>
      <h3 className="mb-3 text-[15px] font-semibold">Habits over time</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={chartAxisTick} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v} /100`, 'Habits']} />
            <Line type="monotone" dataKey="rating" name="Habits" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthLabel } from '@/lib/money'
import type { BudgeScore, BureauScore } from '@/lib/types'

interface ScoreTimelineChartProps {
  history: BudgeScore[]
  bureauScores: BureauScore[]
}

export function ScoreTimelineChart({ history, bureauScores }: ScoreTimelineChartProps) {
  if (history.length < 2 && bureauScores.length === 0) return null

  const points = new Map<string, { label: string; sortKey: string; lootScore?: number; bureauScore?: number }>()

  for (const h of history) {
    points.set(h.month, { label: monthLabel(h.month), sortKey: h.month, lootScore: Math.round(h.score) })
  }
  for (const b of bureauScores) {
    const key = b.reported_on.slice(0, 7)
    const existing = points.get(key)
    if (existing) {
      existing.bureauScore = b.score
    } else {
      points.set(key, { label: monthLabel(`${key}-01`), sortKey: key, bureauScore: b.score })
    }
  }

  const data = [...points.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <div>
      <p className="overline mb-3">Score over time</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 999]} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: '#211B1B', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="lootScore" name="Loot estimate" stroke="#C1FE72" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="bureauScore" name="Bureau score" stroke="#AF72FE" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

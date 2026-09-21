import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { scoreColor } from '@/lib/budge-score'

const COLOR_HEX: Record<'green' | 'amber' | 'red', string> = {
  green: '#C1FE72',
  amber: '#F0C040',
  red: '#FF5C5C',
}

interface ScoreRingProps {
  score: number
  size?: number
}

export function ScoreRing({ score, size = 112 }: ScoreRingProps) {
  const color = scoreColor(score)
  const data = [
    { name: 'score', value: score },
    { name: 'rest', value: Math.max(0, 999 - score) },
  ]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={size * 0.36}
            outerRadius={size * 0.5}
            paddingAngle={2}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            <Cell fill={COLOR_HEX[color]} />
            <Cell fill="rgba(255,255,255,0.08)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-xl font-bold">{Math.round(score)}</span>
        <span className="text-[9px] text-text-muted">/ 999</span>
      </div>
    </div>
  )
}

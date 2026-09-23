import type { CSSProperties } from 'react'

/** Recharts <Tooltip contentStyle> for the v2 theme (follows light/dark via CSS variables). */
export const chartTooltipStyle: CSSProperties = {
  background: 'var(--surface)',
  border: 'none',
  boxShadow: 'var(--shadow-pop)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--fg)',
}

export const chartAxisTick = { fontSize: 11, fill: 'var(--label-2)' }

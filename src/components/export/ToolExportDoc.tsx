/**
 * Export document for the Phase 6 tools (and Future you). Same rules as ExportDocs.tsx: fixed 820px width, money
 * pre-formatted by the caller with plain spaces (see docMoney), no truncation, no letter-spacing.
 */

export interface ToolExportRow {
  section?: string
  label: string
  value: string
  strong?: boolean
}

export function ToolExportDoc({
  title,
  headline,
  rows,
}: {
  title: string
  headline: { label: string; value: string; tone?: 'positive' | 'alert' }
  rows: ToolExportRow[]
}) {
  const sections: { name: string; rows: ToolExportRow[] }[] = []
  for (const r of rows) {
    const name = r.section ?? ''
    const last = sections[sections.length - 1]
    if (last && last.name === name) last.rows.push(r)
    else sections.push({ name, rows: [r] })
  }
  const date = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className="w-[820px] bg-background px-14 py-12 text-foreground" style={{ lineHeight: 1.35 }}>
      <header className="flex items-start justify-between gap-8 border-b border-hairline pb-7">
        <div>
          <div className="flex items-center gap-2">
            <img src="/icons/app-icon.svg" width={22} height={22} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />
            <p className="text-[11px] leading-[1.4] font-semibold text-muted-foreground uppercase">Loot · Tools</p>
          </div>
          <h1 className="mt-4 text-[34px] leading-[1.15] font-bold">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-[1.4] text-muted-foreground">{date}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] leading-[1.4] font-semibold text-muted-foreground uppercase">{headline.label}</p>
          <p className={`tnum mt-2 text-[32px] leading-[1.2] font-bold ${headline.tone === 'alert' ? 'text-alert' : headline.tone === 'positive' ? 'text-primary' : ''}`}>
            {headline.value}
          </p>
        </div>
      </header>
      <div className="mt-7 space-y-5">
        {sections.map((s, i) => (
          <section key={`${s.name}-${i}`} className="card !p-5">
            {s.name && <p className="mb-2 text-[11px] leading-[1.4] font-semibold text-muted-foreground uppercase">{s.name}</p>}
            <table className="w-full text-[14px]">
              <tbody>
                {s.rows.map((r, j) => (
                  <tr key={`${r.label}-${j}`} className={j > 0 ? 'border-t border-hairline' : ''}>
                    <td className="py-2 text-muted-foreground">{r.label}</td>
                    <td className={`tnum py-2 text-right ${r.strong ? 'font-bold' : 'font-semibold'}`}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <footer className="mt-9 border-t border-hairline pt-5 text-[11.5px] leading-[1.45] text-text-subtle">
        Estimates from the figures you entered and Loot’s published rates on the day. Not financial advice.
      </footer>
    </div>
  )
}

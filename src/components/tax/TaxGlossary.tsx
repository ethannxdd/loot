import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TAX_GLOSSARY } from '@/lib/tax/glossary'

export function TaxGlossary() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TAX_GLOSSARY
    return TAX_GLOSSARY.filter((g) => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="card space-y-3">
      <h3 className="text-base font-bold">Tax glossary</h3>
      <div className="relative">
        <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms…"
          className="!pl-9"
        />
      </div>
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {results.map((g) => (
          <div key={g.term}>
            <p className="text-sm font-bold">{g.term}</p>
            <p className="text-xs text-muted-foreground">{g.definition}</p>
          </div>
        ))}
        {results.length === 0 && <p className="text-xs text-text-muted">No terms match "{query}".</p>}
      </div>
    </div>
  )
}

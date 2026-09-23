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
    <div className="card space-y-3 sm:p-6">
      <h3 className="card-title">Tax glossary</h3>
      <div className="relative">
        <Search size={16} strokeWidth={2} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms"
          aria-label="Search tax terms"
          className="!pl-10"
        />
      </div>
      <div className="max-h-96 divide-y divide-hairline overflow-y-auto pr-1">
        {results.map((g) => (
          <div key={g.term} className="py-2.5">
            <p className="text-[14px] font-semibold">{g.term}</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{g.definition}</p>
          </div>
        ))}
        {results.length === 0 && <p className="py-3 text-[13px] text-muted-foreground">No terms match "{query}".</p>}
      </div>
    </div>
  )
}

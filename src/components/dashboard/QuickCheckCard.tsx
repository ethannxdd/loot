import { Link } from '@tanstack/react-router'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAffordabilityChecks } from '@/hooks/useAffordabilityChecks'
import { useRunAffordabilityCheck } from '@/hooks/useRunAffordabilityCheck'
import type { AffordabilityResult } from '@/lib/money'
import { formatCurrencyExact } from '@/lib/utils'
import { VERDICT_META } from '@/lib/verdict'

const VERDICT_DOT: Record<string, string> = {
  comfortable: 'bg-[#3ddc97]',
  tight: 'bg-[#ffb340]',
  'not-recommended': 'bg-[#ff6961]',
}

/**
 * "Can I afford it?" — the dark, Apple-Card-like object on the Dashboard. Runs a real check inline
 * (same logic and history as the Checker page) so the answer arrives without leaving the Dashboard.
 */
export function QuickCheckCard() {
  const { run, ready } = useRunAffordabilityCheck()
  const { data: history = [] } = useAffordabilityChecks()
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [result, setResult] = useState<(AffordabilityResult & { item: string }) | null>(null)

  const last = history[0]

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!item.trim() || !(value > 0)) return
    const r = run({ itemName: item.trim(), amount: value, isRecurring: recurring })
    if (r) setResult({ ...r, item: item.trim() })
  }

  function reset() {
    setResult(null)
    setItem('')
    setAmount('')
  }

  return (
    <section className="object-card flex h-full flex-col p-6" aria-label="Affordability check">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-white/70">
        <Sparkles size={16} strokeWidth={2} className="text-[#5cf0bd]" />
        Affordability check
      </div>

      {result ? (
        <div className="animate-enter mt-3 flex flex-1 flex-col">
          <p className="text-[13px] text-white/60">{result.item}</p>
          <h2 className="mt-1 flex items-center gap-2 text-[26px] font-bold tracking-[-0.025em]">
            <span className={`h-3 w-3 rounded-full ${VERDICT_DOT[result.verdict]}`} />
            {VERDICT_META[result.verdict].label}
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-white/75">{result.reasoning}</p>
          <div className="mt-auto flex gap-2 pt-5">
            <button type="button" onClick={reset} className="btn flex-1 bg-white/12 text-white hover:bg-white/18">
              <RotateCcw size={15} strokeWidth={2.2} /> New check
            </button>
            <Link to="/checker" className="btn flex-1 bg-white text-black">
              Details
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-2 flex flex-1 flex-col">
          <h2 className="mb-4 text-[24px] font-bold leading-tight tracking-[-0.025em]">Can I afford it?</h2>
          <label className="sr-only" htmlFor="qc-item">
            What is it?
          </label>
          <input
            id="qc-item"
            className="object-field mb-2"
            placeholder="What is it?"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            autoComplete="off"
          />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="sr-only" htmlFor="qc-amount">
              Amount
            </label>
            <input
              id="qc-amount"
              className="object-field tnum"
              placeholder="Amount"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex h-11 rounded-xl bg-white/9 p-[3px]" role="group" aria-label="Cost type">
              {[
                { v: false, l: 'Once-off' },
                { v: true, l: 'Monthly' },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  aria-pressed={recurring === o.v}
                  onClick={() => setRecurring(o.v)}
                  className={`flex-1 rounded-[9px] text-[13px] font-semibold transition-colors ${
                    recurring === o.v ? 'bg-white/92 text-black' : 'text-white/60'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!ready || !item.trim() || !(Number(amount) > 0)}
            className="btn mt-1 w-full !rounded-xl bg-white !text-[14.5px] text-black"
          >
            Check it <ArrowRight size={16} strokeWidth={2.2} />
          </button>
          {last && (
            <p className="mt-auto flex items-center gap-2 pt-4 text-[12.5px] text-white/60">
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${VERDICT_DOT[last.verdict]}`} />
              <span className="truncate">
                Last: {last.item_name} {formatCurrencyExact(last.amount)}
                {last.is_recurring ? '/mo' : ''} — {VERDICT_META[last.verdict].label}
              </span>
            </p>
          )}
        </form>
      )}
    </section>
  )
}

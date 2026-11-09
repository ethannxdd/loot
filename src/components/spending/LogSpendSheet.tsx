import { Check, Loader2, X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Select } from '@/components/ui/Select'
import { useLogSpendSheet, type LogSpendPrefill } from '@/context/LogSpendContext'
import { useExpenses } from '@/hooks/useExpenses'
import { useFeature } from '@/hooks/useFeatures'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDeleteSpend, useLogSpend, useMerchantRules, useSafeToSpend } from '@/hooks/useSpendEntries'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, categoryColor, categoryIcon, categoryLabel } from '@/lib/categories'
import { addDays, dateKey, startOfDay } from '@/lib/sa-calendar'
import { fixedOnlyCategories, merchantKey, recentMerchants } from '@/lib/spending'
import { formatCurrency, formatCurrencyExact, getActiveCurrency } from '@/lib/utils'

/**
 * The Log sheet (§3.2, §9). Mounted once in the app shell and opened from + Log (top bar), the hero, /spending and
 * `?log=1`. Portalled to <body> — the top bar's backdrop-filter would otherwise trap a fixed child.
 */
export function LogSpendSheet() {
  const { open, prefill, closeLog } = useLogSpendSheet()
  const live = useFeature('live_cycle')
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>{open && live && <SheetPanel key="log-sheet" prefill={prefill} onClose={closeLog} />}</AnimatePresence>,
    document.body,
  )
}

type When = 'today' | 'yesterday' | 'pick'

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

function SheetPanel({ prefill, onClose }: { prefill: LogSpendPrefill | null; onClose: () => void }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const reduce = useReducedMotion()
  const dragControls = useDragControls()
  const logSpend = useLogSpend()
  const deleteSpend = useDeleteSpend()
  const stats = useSafeToSpend()
  const { data: rules = [] } = useMerchantRules()
  const { data: expenses = [] } = useExpenses()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '')
  const [merchant, setMerchant] = useState(prefill?.merchant ?? '')
  const [category, setCategory] = useState<string | null>(prefill?.category ?? null)
  const [touched, setTouched] = useState(Boolean(prefill?.category))
  const [showAll, setShowAll] = useState(false)
  const [when, setWhen] = useState<When>('today')
  const [picked, setPicked] = useState(dateKey(new Date()))
  const [last, setLast] = useState<string | null>(null)

  const budgets = stats.budgets
  const budgetCats = useMemo(() => new Set(budgets.map((b) => b.category)), [budgets])
  const fixedOnly = useMemo(() => fixedOnlyCategories(expenses), [expenses])
  const merchants = useMemo(() => recentMerchants(stats.entries), [stats.entries])
  const typedKey = merchantKey(merchant)
  const suggestions = typedKey
    ? merchants.filter((m) => {
        const k = merchantKey(m)
        return k.startsWith(typedKey) && k !== typedKey
      }).slice(0, 4)
    : []

  // Merchant memory: a merchant seen before pre-selects its category (unless the person already chose one).
  useEffect(() => {
    if (touched || !typedKey) return
    const rule = rules.find((r) => r.merchant_key === typedKey)
    if (!rule) return
    setCategory(rule.category)
    if (!budgetCats.has(rule.category)) setShowAll(true)
  }, [typedKey, rules, touched, budgetCats])

  // Escape closes; the page underneath doesn't scroll while the sheet is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => amountRef.current?.focus(), reduce ? 0 : 180)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      window.clearTimeout(t)
    }
  }, [onClose, reduce])

  const value = parseAmount(amount)
  const valid = value > 0 && Boolean(category)
  const symbol = formatCurrency(0).replace(/[\d\s.,-]/g, '') || getActiveCurrency()

  function spentAt(): string {
    const now = new Date()
    if (when === 'today') return now.toISOString()
    const day = when === 'yesterday' ? addDays(startOfDay(now), -1) : new Date(`${picked}T00:00:00`)
    if (dateKey(day) === dateKey(now)) return now.toISOString()
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString()
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!valid || logSpend.isPending) return
    const cat = category!
    const leftBefore = stats.budgetsLeft[cat]
    const leftAfter = leftBefore === undefined ? undefined : Math.max(0, leftBefore - value)
    const text = `Logged ${formatCurrencyExact(value)}${merchant.trim() ? ` at ${merchant.trim()}` : ''}`
    const detail = leftAfter === undefined ? `${categoryLabel(cat)} · not in a budget` : `${categoryLabel(cat)} ${formatCurrency(leftAfter)} left`
    logSpend.mutate(
      { amount: value, merchant: merchant.trim() || null, category: cat, spent_at: spentAt() },
      {
        onSuccess: (saved) => {
          toast.success(`Logged ${formatCurrencyExact(value)} · ${detail}`, {
            action: { label: 'Undo', onClick: () => deleteSpend.mutate({ id: saved.id, soft: false }) },
          })
        },
      },
    )
    setLast(text)
    setAmount('')
    setMerchant('')
    setCategory(null)
    setTouched(false)
    setShowAll(false)
    amountRef.current?.focus()
  }

  const otherOptions = EXPENSE_CATEGORIES.filter((c) => !budgetCats.has(c)).map((c) => ({
    value: c,
    label: fixedOnly.has(c) ? `${CATEGORY_LABELS[c]} · debit order` : CATEGORY_LABELS[c],
  }))

  const panel = (
    <form onSubmit={submit} className="flex max-h-[calc(100dvh-40px)] flex-col" aria-label="Log a spend">
      {!desktop && (
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-1"
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-fill-2" />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-5 pt-3 sm:px-6 sm:pt-5">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">Log a spend</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pt-4 pb-4 sm:px-6">
        {last && (
          <p className="flex items-center gap-2 rounded-xl bg-[var(--accent-tint)] px-3.5 py-2.5 text-[13px] font-medium text-primary" role="status">
            <Check size={15} strokeWidth={2.4} /> {last}. Log another or tap Done.
          </p>
        )}

        <label className="block">
          <span className="sr-only">Amount</span>
          <span className="flex items-baseline gap-2 border-b-2 border-hairline pb-2 transition-colors focus-within:border-primary">
            <span className="text-[24px] font-semibold text-muted-foreground">{symbol}</span>
            <input
              ref={amountRef}
              className="spend-amount-input min-w-0 flex-1"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ''))}
              aria-label="Amount"
              data-testid="log-amount"
            />
          </span>
        </label>

        <div>
          <label className="field-label" htmlFor="log-merchant">
            Where or what
          </label>
          <input
            id="log-merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Woolworths, taxi, coffee…"
            autoComplete="off"
            maxLength={120}
          />
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((m) => (
                <button key={m} type="button" onClick={() => setMerchant(m)} className="chip chip-neutral hover:bg-fill-2">
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="field-label">Category</span>
          {budgets.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {budgets.map((b) => {
                const Icon = categoryIcon(b.category)
                const selected = category === b.category
                return (
                  <button
                    key={b.category}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCategory(b.category)
                      setTouched(true)
                      setShowAll(false)
                    }}
                    className={`flex min-w-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                      selected ? 'bg-[var(--accent-tint)] ring-2 ring-primary' : 'bg-fill hover:bg-fill-2'
                    }`}
                  >
                    <span className="icon-tile !h-8 !w-8 !rounded-[9px]" style={{ background: categoryColor(b.category) }}>
                      <Icon size={15} strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold">{categoryLabel(b.category)}</span>
                      <span className="tnum block truncate text-[12px] text-muted-foreground">
                        {formatCurrency(stats.budgetsLeft[b.category] ?? 0)} left
                      </span>
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={showAll}
                onClick={() => setShowAll(true)}
                className={`flex min-h-[52px] items-center justify-center rounded-2xl px-3 text-[13.5px] font-semibold transition-colors ${
                  showAll ? 'bg-[var(--accent-tint)] text-primary ring-2 ring-primary' : 'bg-fill text-muted-foreground hover:bg-fill-2'
                }`}
              >
                Something else
              </button>
            </div>
          )}
          {(showAll || budgets.length === 0) && (
            <div className={budgets.length > 0 ? 'mt-2.5' : ''}>
              <Select
                aria-label="Category"
                value={category && !budgetCats.has(category) ? category : ''}
                placeholder="Choose a category"
                onValueChange={(v) => {
                  setCategory(v)
                  setTouched(true)
                }}
                options={otherOptions}
              />
              {category && fixedOnly.has(category) && (
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  Debit orders are already counted. Log here only for something extra — it counts as unplanned.
                </p>
              )}
              {budgets.length === 0 && (
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  Add variable expenses (like groceries) on the Expenses page and they become budgets you can log against.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <span className="field-label">When</span>
          <div className="flex flex-wrap items-center gap-2">
            {(['today', 'yesterday'] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={when === w}
                onClick={() => setWhen(w)}
                className={`chip !h-9 !px-3.5 !text-[13.5px] ${when === w ? 'bg-ink text-ink-foreground' : 'chip-neutral'}`}
              >
                {w === 'today' ? 'Today' : 'Yesterday'}
              </button>
            ))}
            <input
              type="date"
              aria-label="Pick a date"
              value={picked}
              max={dateKey(new Date())}
              onChange={(e) => {
                setPicked(e.target.value)
                setWhen('pick')
              }}
              className={`!h-9 !w-auto !rounded-full !px-3 !text-[13.5px] ${when === 'pick' ? '!ring-2 !ring-primary' : ''}`}
            />
          </div>
        </div>
      </div>

      <div
        className="flex gap-3 border-t border-hairline px-5 pt-3 sm:px-6 sm:pb-5"
        style={{ paddingBottom: desktop ? undefined : 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
          Done
        </button>
        <button type="submit" disabled={!valid || logSpend.isPending} className="btn btn-primary flex-[2]" data-testid="log-submit">
          {logSpend.isPending && <Loader2 size={16} className="animate-spin" />}
          {value > 0 ? `Log ${formatCurrencyExact(value)}` : 'Log it'}
        </button>
      </div>
    </form>
  )

  return (
    <div className="fixed inset-0 z-[70]" data-testid="log-sheet">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      {desktop ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Log a spend"
          className="log-sheet absolute inset-x-0 bottom-8 mx-auto w-[min(92vw,480px)] overflow-hidden rounded-[26px]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
          transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 36 }}
        >
          {panel}
        </motion.div>
      ) : (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Log a spend"
          className="log-sheet absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[26px]"
          drag={reduce ? false : 'y'}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 110 || info.velocity.y > 600) onClose()
          }}
          initial={reduce ? { opacity: 0 } : { y: '100%' }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: '100%', transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }}
          transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 380, damping: 38 }}
        >
          {panel}
        </motion.div>
      )}
    </div>
  )
}

import { ArrowLeft, Copy, Layers, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PlanExportDoc } from '@/components/export/ExportDocs'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Select } from '@/components/ui/Select'
import { useAddExpenses, useExpenses } from '@/hooks/useExpenses'
import { useCreatePlannerPlan, useUpdatePlannerPlan } from '@/hooks/usePlannerPlans'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useProfile } from '@/hooks/useProfile'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, categoryColor, categoryIcon, categoryLabel } from '@/lib/categories'
import { exportDocument } from '@/lib/export'
import { phaseToExpenses } from '@/lib/planner-apply'
import { computePhase, emptyPhase, itemFrequency, itemMonthly, normalisePhase, phaseTotalExpenses } from '@/lib/planner-math'
import { estimateEffectiveTaxRatePct } from '@/lib/tax/tax-math'
import { EXPENSE_FREQUENCIES, type ExpenseFrequency, type PlannerExpenseItem, type PlannerPhase, type PlannerPlan } from '@/lib/types'
import { formatCurrency, formatCurrencyExact } from '@/lib/utils'
import { PlanTargetPanel } from './PlanTargetPanel'

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  annual: 'Annual',
  'once-off': 'Once-off',
}

interface Draft {
  name: string
  taxRate: string
  phases: PlannerPhase[]
  notes: string
}

interface PlanWorkspaceProps {
  /** The saved plan being edited, or undefined for a new one. */
  plan?: PlannerPlan
  plans: PlannerPlan[]
  /** Leave the workspace (back to all plans). */
  onClose: () => void
  /** Open another plan (or 'new'). */
  onOpen: (id: string | 'new') => void
}

const toNumber = (v: string) => (v === '' ? 0 : Number(v) || 0)
const numOrBlank = (n: number | null | undefined) => (n ? String(n) : '')

/**
 * The salary planner workspace (parity with the original Lovable planner): sketch each phase of the life you
 * want — expenses with a frequency and a leftover target — and see the take-home and gross salary it needs.
 */
export function PlanWorkspace({ plan, plans, onClose, onOpen }: PlanWorkspaceProps) {
  const { data: profile } = useProfile()
  const { data: expenses = [] } = useExpenses()
  const createPlan = useCreatePlannerPlan()
  const updatePlan = useUpdatePlannerPlan()
  const addExpenses = useAddExpenses()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const initialDraft = useMemo<Draft>(() => {
    if (plan) {
      return {
        name: plan.name,
        taxRate: String(plan.tax_rate_pct ?? 0),
        phases: plan.phases.length > 0 ? plan.phases.map(normalisePhase) : [emptyPhase()],
        notes: plan.notes ?? '',
      }
    }
    // New plans start at the user's own effective rate — the salary they earn now is the best first guess.
    const gross = profile?.gross_income ?? 0
    return { name: '', taxRate: String(gross > 0 ? estimateEffectiveTaxRatePct(gross) : 25), phases: [emptyPhase()], notes: '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, plan?.updated_at])

  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [saved, setSaved] = useState<Draft>(initialDraft)
  const [active, setActive] = useState(0)
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)

  // A new plan's rate depends on the profile, which may load after mount — adopt it until the user edits.
  const touchedRate = useRef(false)
  useEffect(() => {
    if (!plan && !touchedRate.current && profile) {
      setDraft((d) => ({ ...d, taxRate: initialDraft.taxRate }))
      setSaved((d) => ({ ...d, taxRate: initialDraft.taxRate }))
    }
  }, [plan, profile, initialDraft.taxRate])

  const isNew = !plan
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const phase = draft.phases[Math.min(active, draft.phases.length - 1)]
  const activeIndex = Math.min(active, draft.phases.length - 1)

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function guard(action: () => void) {
    if (isDirty) setPendingNav(() => action)
    else action()
  }

  function setPhase(index: number, patch: Partial<PlannerPhase>) {
    setDraft((d) => ({ ...d, phases: d.phases.map((p, i) => (i === index ? { ...p, ...patch } : p)) }))
  }

  function addPhase() {
    setDraft((d) => ({ ...d, phases: [...d.phases, emptyPhase(`Phase ${d.phases.length + 1}`)] }))
    setActive(draft.phases.length)
  }

  function duplicatePhase(index: number) {
    setDraft((d) => {
      const src = d.phases[index]
      const copy: PlannerPhase = { ...src, name: `${src.name || `Phase ${index + 1}`} (copy)`, expenses: src.expenses.map((e) => ({ ...e })) }
      const phases = [...d.phases]
      phases.splice(index + 1, 0, copy)
      return { ...d, phases }
    })
    setActive(index + 1)
    toast.success('Phase duplicated')
  }

  function removePhase(index: number) {
    setDraft((d) => ({ ...d, phases: d.phases.filter((_, i) => i !== index) }))
    setActive((a) => Math.max(0, a >= index ? a - 1 : a))
    setRemoveIndex(null)
  }

  // ---- Save --------------------------------------------------------------------------------------------------

  function values(nameOverride?: string) {
    const rate = toNumber(draft.taxRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 60) {
      toast.error('The tax rate must be between 0% and 60%.')
      return null
    }
    return {
      name: (nameOverride ?? draft.name).trim() || 'Untitled plan',
      tax_rate_pct: rate,
      phases: draft.phases.map((p, i) => ({
        ...p,
        name: p.name.trim() || `Phase ${i + 1}`,
        expenses: p.expenses.filter((e) => e.name.trim() || e.amount).map((e) => ({ ...e, name: e.name.trim() || 'Expense' })),
      })),
      // null (not undefined) so clearing the notes on an existing plan actually clears them.
      notes: draft.notes.trim() || null,
    }
  }

  function save() {
    const v = values()
    if (!v) return
    if (isNew) {
      createPlan.mutate(v, {
        onSuccess: (created) => {
          toast.success(`${created.name} saved`)
          onOpen(created.id)
        },
      })
    } else {
      updatePlan.mutate(
        { id: plan!.id, patch: v },
        {
          onSuccess: () => {
            const next = { ...draft, name: v.name }
            setDraft(next)
            setSaved(next)
            toast.success('Plan saved')
          },
        },
      )
    }
  }

  function saveAsNew() {
    const base = draft.name.trim() || 'Untitled plan'
    const v = values(`${base} (copy)`)
    if (!v) return
    createPlan.mutate(v, {
      onSuccess: (created) => {
        toast.success(`Saved as ${created.name}`)
        onOpen(created.id)
      },
    })
  }

  // ---- Apply to expenses -------------------------------------------------------------------------------------

  const applyPreview = useMemo(() => phaseToExpenses(phase, expenses), [phase, expenses])

  async function applyToExpenses() {
    try {
      await addExpenses.mutateAsync(applyPreview.toAdd)
      setApplyOpen(false)
      const n = applyPreview.toAdd.length
      toast.success(`Added ${n} expense${n === 1 ? '' : 's'} to Loot`, {
        description: applyPreview.skipped > 0 ? `${applyPreview.skipped} already in your expenses were skipped.` : 'Find them under Expenses.',
      })
    } catch {
      /* the global mutation toast explains the error; keep the dialog open */
    }
  }

  // ---- Export -------------------------------------------------------------------------------------------------

  function exportPlan(format: 'png' | 'pdf') {
    const v = values()
    if (!v) return
    const doc: PlannerPlan = {
      id: plan?.id ?? 'draft',
      user_id: plan?.user_id ?? '',
      created_at: plan?.created_at ?? '',
      updated_at: plan?.updated_at ?? '',
      ...v,
    }
    void exportDocument(<PlanExportDoc plan={doc} currentNet={profile?.net_income ?? 0} />, `${v.name}-plan`, format)
  }

  const rate = toNumber(draft.taxRate)
  const phaseComputed = computePhase(phase, rate)

  const targetPanel = (
    <PlanTargetPanel
      phases={draft.phases}
      activeIndex={activeIndex}
      taxRate={draft.taxRate}
      onTaxRateChange={(v) => {
        touchedRate.current = true
        setDraft((d) => ({ ...d, taxRate: v }))
      }}
      onSelectPhase={setActive}
      currentNet={profile?.net_income ?? 0}
      currentGross={profile?.gross_income ?? 0}
      isNew={isNew}
      isDirty={isDirty}
      isSaving={createPlan.isPending || updatePlan.isPending}
      onSave={save}
      onSaveAsNew={saveAsNew}
      onApply={() => setApplyOpen(true)}
      onExport={exportPlan}
    />
  )

  return (
    <div className="animate-enter space-y-6" data-testid="plan-workspace">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button type="button" onClick={() => guard(onClose)} className="btn btn-ghost !pl-3">
          <ArrowLeft size={16} strokeWidth={2} /> All plans
        </button>
        <div className="flex items-center gap-2">
          {plans.length > 0 && (
            <Select
              aria-label="Open a saved plan"
              value={plan?.id ?? ''}
              placeholder={`Saved (${plans.length})`}
              onValueChange={(id) => id !== plan?.id && guard(() => onOpen(id))}
              options={plans.map((p) => ({ value: p.id, label: p.name }))}
              className="w-[190px]"
            />
          )}
          <button type="button" onClick={() => guard(() => onOpen('new'))} className="btn btn-secondary" disabled={isNew && !isDirty}>
            <Plus size={15} strokeWidth={2.4} /> New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          {/* Title */}
          <div>
            <p className="page-eyebrow mb-1 flex items-center gap-2">
              Salary planner
              {isDirty && <span className="chip chip-caution !h-5 !px-2 !text-[11px] !normal-case !tracking-normal">Unsaved</span>}
            </p>
            <label className="group flex items-center gap-2">
              <Pencil size={17} strokeWidth={2} className="shrink-0 text-text-subtle group-focus-within:text-primary" aria-hidden />
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Untitled plan"
                aria-label="Plan name"
                data-testid="plan-name"
                className="page-title min-w-0 flex-1 !border-0 !bg-transparent !p-0 !shadow-none !ring-0 placeholder:text-text-subtle"
              />
            </label>
            <p className="mt-1.5 max-w-xl text-[15px] text-muted-foreground">
              Sketch the life you want across one or more phases — different lifestyles, timelines or what-ifs. Loot works out
              what your salary needs to be.
            </p>
          </div>

          {/* Phases */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Phases">
            <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Layers size={14} strokeWidth={2} /> Phases
            </span>
            {draft.phases.map((p, i) => {
              const on = i === activeIndex
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${
                    on ? 'bg-foreground text-background' : 'bg-fill text-foreground hover:bg-fill-2'
                  }`}
                >
                  <span className="max-w-[140px] truncate">{p.name || `Phase ${i + 1}`}</span>
                  <span className={`tnum text-[12.5px] font-medium ${on ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {formatCurrency(phaseTotalExpenses(p))}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={addPhase}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} strokeWidth={2.4} /> Phase
            </button>
          </div>

          {/* Active phase */}
          <section className="card space-y-4 sm:p-6" aria-label="Phase details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="phase-name">
                  Phase name
                </label>
                <input
                  id="phase-name"
                  value={phase.name}
                  onChange={(e) => setPhase(activeIndex, { name: e.target.value })}
                  placeholder="e.g. Moving out, Year one in Berlin"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="phase-leftover">
                  Leftover target / month
                </label>
                <input
                  id="phase-leftover"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={numOrBlank(phase.leftover_target)}
                  onChange={(e) => setPhase(activeIndex, { leftover_target: toNumber(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="phase-months">
                  How long? <span className="font-normal text-text-subtle">(months, optional)</span>
                </label>
                <input
                  id="phase-months"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={numOrBlank(phase.months)}
                  onChange={(e) => setPhase(activeIndex, { months: Math.max(0, Math.round(toNumber(e.target.value))) || null })}
                  placeholder="Open-ended"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="phase-salary">
                  Test a salary <span className="font-normal text-text-subtle">(gross / month, optional)</span>
                </label>
                <input
                  id="phase-salary"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={numOrBlank(phase.gross_income)}
                  onChange={(e) => setPhase(activeIndex, { gross_income: toNumber(e.target.value) })}
                  placeholder="e.g. a job offer — leave blank to compare with what you earn now"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
              <div className="flex gap-1">
                <button type="button" onClick={() => duplicatePhase(activeIndex)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                  <Copy size={14} strokeWidth={2} /> Duplicate
                </button>
                {draft.phases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => (phase.expenses.length > 0 ? setRemoveIndex(activeIndex) : removePhase(activeIndex))}
                    className="btn btn-ghost !min-h-9 !px-3 !text-[13px] hover:!text-alert"
                  >
                    <Trash2 size={14} strokeWidth={2} /> Remove
                  </button>
                )}
              </div>
              <p className="tnum text-[13px] text-muted-foreground">
                Phase monthly <b className="text-foreground">{formatCurrency(phaseComputed.totalExpenses)}</b> · needs{' '}
                <b className="text-primary">{formatCurrency(phaseComputed.requiredGross)}</b> gross
              </p>
            </div>
          </section>

          <ItemComposer
            key={activeIndex}
            phaseName={phase.name || `Phase ${activeIndex + 1}`}
            items={phase.expenses}
            months={phase.months}
            onChange={(items) => setPhase(activeIndex, { expenses: items })}
          />

          {!isDesktop && targetPanel}

          <div>
            <label className="field-label" htmlFor="plan-notes">
              Notes <span className="font-normal text-text-subtle">(optional)</span>
            </label>
            <textarea
              id="plan-notes"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
              placeholder="Assumptions, context, anything worth remembering later…"
            />
          </div>
        </div>

        {isDesktop && <div className="lg:sticky lg:top-6 lg:col-span-5">{targetPanel}</div>}
      </div>

      {pendingNav && (
        <ConfirmModal
          title="Discard your changes?"
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setPendingNav(null)}
          onConfirm={() => {
            const go = pendingNav
            setPendingNav(null)
            go()
          }}
        >
          <p>This plan has changes you haven&apos;t saved. Leaving now throws them away.</p>
        </ConfirmModal>
      )}

      {removeIndex !== null && (
        <ConfirmModal
          title="Remove this phase?"
          confirmLabel="Remove phase"
          onCancel={() => setRemoveIndex(null)}
          onConfirm={() => removePhase(removeIndex)}
        >
          <p>
            <span className="font-semibold text-foreground">{draft.phases[removeIndex]?.name || 'This phase'}</span> and its{' '}
            {draft.phases[removeIndex]?.expenses.length} item(s) will be removed from the plan.
          </p>
        </ConfirmModal>
      )}

      {applyOpen && (
        <ConfirmModal
          title="Add this phase to your expenses?"
          confirmLabel={applyPreview.toAdd.length > 0 ? `Add ${applyPreview.toAdd.length} expense${applyPreview.toAdd.length === 1 ? '' : 's'}` : 'Nothing to add'}
          destructive={false}
          isPending={addExpenses.isPending}
          onCancel={() => setApplyOpen(false)}
          onConfirm={() => (applyPreview.toAdd.length > 0 ? void applyToExpenses() : setApplyOpen(false))}
        >
          {applyPreview.toAdd.length > 0 ? (
            <div className="space-y-2">
              <p>
                These items from <span className="font-semibold text-foreground">{phase.name || 'this phase'}</span> become real expenses
                in Loot and count towards what you have left each month.
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-fill px-3 py-2 text-[13.5px]">
                {applyPreview.toAdd.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate text-foreground">{e.name}</span>
                    <span className="tnum shrink-0">
                      {formatCurrencyExact(e.amount)} {e.frequency !== 'monthly' && <span className="text-muted-foreground">{FREQUENCY_LABELS[e.frequency].toLowerCase()}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {applyPreview.skipped > 0 && <p>{applyPreview.skipped} already in your expenses will be skipped.</p>}
            </div>
          ) : (
            <p>Everything in this phase is already in your expenses.</p>
          )}
        </ConfirmModal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Add / edit the items of one phase
// ---------------------------------------------------------------------------------------------------------------

interface ItemComposerProps {
  phaseName: string
  items: PlannerExpenseItem[]
  months?: number | null
  onChange: (items: PlannerExpenseItem[]) => void
}

function ItemComposer({ phaseName, items, months, onChange }: ItemComposerProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('housing')
  const [frequency, setFrequency] = useState<ExpenseFrequency>('monthly')
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function reset() {
    setName('')
    setAmount('')
    setEditing(null)
    setError(null)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!name.trim()) return setError('What is it? Give the item a name.')
    if (!(value > 0)) return setError('Enter an amount above zero.')
    const item: PlannerExpenseItem = { name: name.trim(), amount: value, category, frequency }
    onChange(editing === null ? [...items, item] : items.map((it, i) => (i === editing ? item : it)))
    reset()
    nameRef.current?.focus()
  }

  function edit(index: number) {
    const it = items[index]
    setEditing(index)
    setName(it.name)
    setAmount(it.amount ? String(it.amount) : '')
    setCategory(it.category ?? 'other')
    setFrequency(itemFrequency(it))
    setError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
    if (editing === index) reset()
  }

  return (
    <>
      <form ref={formRef} onSubmit={submit} className="card space-y-3 sm:p-6" aria-label="Add an expense to this phase" noValidate>
        <div className="flex items-center justify-between gap-2">
          <p className="overline-label truncate">{editing === null ? `Add to “${phaseName}”` : 'Edit item'}</p>
          {editing !== null && (
            <button type="button" onClick={reset} className="flex items-center gap-1 text-[13px] font-semibold text-muted-foreground">
              <X size={14} strokeWidth={2.2} /> Cancel
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <input
            ref={nameRef}
            className="col-span-2 sm:col-span-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dream apartment"
            aria-label="What is it?"
            data-testid="item-name"
          />
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            aria-label="Amount"
            data-testid="item-amount"
          />
          <Select
            aria-label="Category"
            value={category}
            onValueChange={setCategory}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            className="order-last col-span-2 sm:order-none sm:col-span-1"
          />
          <Select
            aria-label="How often"
            value={frequency}
            onValueChange={(v) => setFrequency(v as ExpenseFrequency)}
            options={EXPENSE_FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
          />
        </div>
        {error && (
          <p role="alert" className="text-[13px] font-medium text-alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" data-testid="item-add">
          {editing === null ? (
            <>
              <Plus size={16} strokeWidth={2.4} /> Add
            </>
          ) : (
            'Save item'
          )}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[14px] text-muted-foreground">
          Start sketching this phase above.
        </p>
      ) : (
        <section className="card !px-4 !py-2" aria-label="Items in this phase" data-testid="plan-items">
          {items.map((it, i) => {
            const Icon = categoryIcon(it.category ?? 'other')
            const freq = itemFrequency(it)
            const monthly = itemMonthly(it, months)
            return (
              <div key={i} className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-hairline' : ''} ${editing === i ? 'opacity-50' : ''}`}>
                <span
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] text-white"
                  style={{ background: categoryColor(it.category ?? 'other') }}
                >
                  <Icon size={16} strokeWidth={2.1} />
                </span>
                <button type="button" onClick={() => edit(i)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${it.name}`}>
                  <span className="block truncate text-[15px] font-semibold">{it.name || 'Unnamed'}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {categoryLabel(it.category ?? 'other')} · {FREQUENCY_LABELS[freq]}
                    {freq === 'once-off' && (months ? ` · spread over ${months} mo` : ' · up front')}
                  </span>
                </button>
                <div className="shrink-0 text-right">
                  <span className="tnum block text-[15px] font-semibold">{formatCurrencyExact(it.amount)}</span>
                  {freq !== 'monthly' && monthly > 0 && (
                    <span className="tnum block text-[12px] text-muted-foreground">≈ {formatCurrency(monthly)}/mo</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${it.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-subtle hover:bg-fill hover:text-alert"
                >
                  <Trash2 size={15} strokeWidth={1.9} />
                </button>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}

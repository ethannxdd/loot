import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Download, FolderOpen, ListPlus, Loader2, Save, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ToolExportDoc, type ToolExportRow } from '@/components/export/ToolExportDoc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useDeleteScenario, useSaveScenario, useScenarios, type ToolKey } from '@/hooks/useDecide'
import { usePlannerPlans, useUpdatePlannerPlan } from '@/hooks/usePlannerPlans'
import { exportDocument } from '@/lib/export'
import type { PlannerExpenseItem } from '@/lib/types'

export interface ToolAction {
  /** For "Add to planner phase": the monthly items this tool's result adds. */
  plannerItems?: PlannerExpenseItem[]
  /** For "Run a check": what to check and how much. */
  check?: { item: string; amount: number; recurring: boolean }
}

interface ToolShellProps<T extends object> {
  tool: ToolKey
  title: string
  subtitle: string
  inputs: T
  onLoad: (inputs: T) => void
  /** Inputs column. */
  form: ReactNode
  /** Results column. */
  results: ReactNode
  /** Export document content. */
  exportRows: ToolExportRow[]
  headline: { label: string; value: string; tone?: 'positive' | 'alert' }
  actions?: ToolAction
  backTo?: string
}

/**
 * The shared tool workspace (§4.5): inputs left / results right on desktop, stacked on phones, with Save scenario
 * (inputs only), Export (PNG/PDF), Add to planner phase and Run a check. Tools never write expenses by themselves.
 */
export function ToolShell<T extends object>({
  tool,
  title,
  subtitle,
  inputs,
  onLoad,
  form,
  results,
  exportRows,
  headline,
  actions,
  backTo = '/tools',
}: ToolShellProps<T>) {
  const { data: scenarios = [] } = useScenarios(tool)
  const save = useSaveScenario()
  const remove = useDeleteScenario()
  const { data: plans = [] } = usePlannerPlans()
  const updatePlan = useUpdatePlannerPlan()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loadedId, setLoadedId] = useState<string | undefined>()
  const [planTarget, setPlanTarget] = useState('')
  const [panel, setPanel] = useState<'none' | 'save' | 'planner'>('none')

  function doSave() {
    save.mutate(
      { id: loadedId, tool, name: name || title, inputs },
      {
        onSuccess: () => {
          toast.success(loadedId ? 'Scenario updated' : 'Scenario saved')
          setPanel('none')
        },
      },
    )
  }

  function addToPlanner() {
    const [planId, phaseIdx] = planTarget.split(':')
    const plan = plans.find((p) => p.id === planId)
    if (!plan || !actions?.plannerItems) return
    const phases = plan.phases.map((ph, i) => (i === Number(phaseIdx) ? { ...ph, expenses: [...ph.expenses, ...actions.plannerItems!] } : ph))
    updatePlan.mutate(
      { id: plan.id, patch: { phases } },
      {
        onSuccess: () => {
          toast.success(`Added to ${plan.name} · ${plan.phases[Number(phaseIdx)].name}`)
          setPanel('none')
        },
      },
    )
  }

  return (
    <div className="animate-enter space-y-6">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary">
        <ArrowLeft size={16} /> Tools
      </Link>
      <PageHeader
        eyebrow="Tools"
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {scenarios.length > 0 && (
              <div className="min-w-44">
                <Select
                  aria-label="Saved scenarios"
                  value={loadedId ?? ''}
                  placeholder="Saved scenarios"
                  onValueChange={(id) => {
                    const s = scenarios.find((x) => x.id === id)
                    if (!s) return
                    setLoadedId(id)
                    setName(s.name)
                    onLoad({ ...inputs, ...(s.inputs as Partial<T>) })
                    toast(`Loaded ${s.name}`)
                  }}
                  options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
            )}
            <button type="button" onClick={() => setPanel(panel === 'save' ? 'none' : 'save')} className="btn btn-secondary">
              <Save size={15} /> Save
            </button>
            <button
              type="button"
              onClick={() =>
                void exportDocument(<ToolExportDoc title={title} headline={headline} rows={exportRows} />, `loot-${tool}-${new Date().toISOString().slice(0, 10)}`, 'pdf')
              }
              className="btn btn-secondary"
            >
              <Download size={15} /> Export
            </button>
          </>
        }
      />

      {panel === 'save' && (
        <div className="card flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="field-label" htmlFor="scenario-name">
              Scenario name
            </label>
            <input id="scenario-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={title} />
          </div>
          <button type="button" onClick={doSave} disabled={save.isPending} className="btn btn-primary">
            {save.isPending && <Loader2 size={15} className="animate-spin" />}
            {loadedId ? 'Update' : 'Save scenario'}
          </button>
          {loadedId && (
            <button
              type="button"
              onClick={() => remove.mutate(loadedId, { onSuccess: () => { setLoadedId(undefined); toast.success('Scenario deleted') } })}
              className="btn btn-ghost text-alert"
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
          <p className="w-full text-[12.5px] text-muted-foreground">Only your inputs are saved. Results are worked out fresh each time.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="card space-y-4 lg:col-span-5" aria-label="Inputs">
          {form}
        </section>
        <div className="space-y-4 lg:col-span-7">
          {results}
          {(actions?.plannerItems || actions?.check) && (
            <div className="card flex flex-wrap gap-2">
              {actions.plannerItems && plans.length > 0 && (
                <button type="button" onClick={() => setPanel(panel === 'planner' ? 'none' : 'planner')} className="btn btn-secondary">
                  <ListPlus size={15} /> Add to planner phase
                </button>
              )}
              {actions.check && (
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: '/checker',
                      search: { item: actions.check!.item, amount: Math.round(actions.check!.amount), recurring: actions.check!.recurring ? 1 : 0 },
                    })
                  }
                  className="btn btn-secondary"
                >
                  <Sparkles size={15} /> Run a check
                </button>
              )}
              {panel === 'planner' && (
                <div className="flex w-full flex-wrap items-end gap-2 pt-2">
                  <div className="min-w-56 flex-1">
                    <Select
                      aria-label="Plan and phase"
                      value={planTarget}
                      placeholder="Choose a plan and phase"
                      onValueChange={setPlanTarget}
                      options={plans.flatMap((p) => p.phases.map((ph, i) => ({ value: `${p.id}:${i}`, label: `${p.name} · ${ph.name}` })))}
                    />
                  </div>
                  <button type="button" disabled={!planTarget || updatePlan.isPending} onClick={addToPlanner} className="btn btn-primary">
                    <FolderOpen size={15} /> Add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** A labelled number input bound to one numeric field. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  step = 'any',
  min = 0,
  hint,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  suffix?: string
  step?: string
  min?: number
  hint?: string
}) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        {suffix && <span className="font-normal text-text-subtle"> · {suffix}</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
      {hint && <p className="mt-1 text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A result figure row. */
export function ResultRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'positive' | 'alert' | 'caution' }) {
  const color = tone === 'positive' ? 'text-primary' : tone === 'alert' ? 'text-alert' : tone === 'caution' ? 'text-caution' : ''
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-[14px] text-muted-foreground">{label}</span>
      <span className={`tnum text-right ${strong ? 'text-[18px] font-bold' : 'text-[15px] font-semibold'} ${color}`}>{value}</span>
    </div>
  )
}

/** A horizontal stacked bar with a legend. */
export function StackedBar({ parts }: { parts: { key: string; label: string; amount: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.amount), 0) || 1
  const shown = parts.filter((p) => p.amount > 0)
  return (
    <div>
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full" role="img" aria-label={shown.map((p) => p.label).join(', ')}>
        {shown.map((p) => (
          <span key={p.key} style={{ width: `${(p.amount / total) * 100}%`, background: p.color }} className="first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {shown.map((p) => (
          <span key={p.key} className="text-[12.5px] text-muted-foreground">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-[3px]" style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

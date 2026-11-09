import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ActionDialog, AdminCard, ErrorNote, KV } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useAdminMe } from '@/hooks/useAdmin'
import { useAdminContent, useContentActions, usePriceEventReach } from '@/hooks/useAdminV2'
import { formatDate, roleAtLeast } from '@/lib/admin'
import { contentMinRole, type AdminPriceEvent, type ContentSetting } from '@/lib/admin-v2'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/categories'
import { resolveContent, staleContent, validateTaxTable } from '@/lib/content'
import { CONTENT_DEFAULTS } from '@/lib/content-defaults'
import { computeGrossTax, computeRebates } from '@/lib/tax/tax-math'
import { TAX_TABLES, getCurrentTaxYear, type TaxBracket, type TaxTable } from '@/lib/tax/tax-tables'
import { PRICE_EVENT_KINDS } from '@/lib/stay-ahead'

type Tab = 'prices' | 'tax' | 'limits' | 'seasons'

/** Simple field specs for the JSON settings (path → label). */
interface Field {
  path: string[]
  label: string
  type: 'number' | 'date' | 'text'
}

const SETTINGS: Record<'limits' | 'seasons', { key: string; title: string; hint?: string; fields: Field[] }[]> = {
  limits: [
    {
      key: 'fuel_prices',
      title: 'Fuel prices',
      hint: 'DMPR, first Wednesday of the month. Rand per litre.',
      fields: [
        { path: ['effective'], label: 'Effective from', type: 'date' },
        { path: ['petrol95', 'inland'], label: '95 inland', type: 'number' },
        { path: ['petrol95', 'coastal'], label: '95 coastal', type: 'number' },
        { path: ['diesel', 'inland'], label: 'Diesel 500ppm inland', type: 'number' },
        { path: ['diesel', 'coastal'], label: 'Diesel 500ppm coastal', type: 'number' },
      ],
    },
    { key: 'prime_rate', title: 'Prime rate', hint: 'SARB repo + 3.5.', fields: [{ path: ['rate'], label: 'Prime %', type: 'number' }, { path: ['effective'], label: 'Effective from', type: 'date' }] },
    {
      key: 'tfsa_limits',
      title: 'TFSA limits',
      fields: [
        { path: ['annual'], label: 'Annual', type: 'number' },
        { path: ['lifetime'], label: 'Lifetime', type: 'number' },
        { path: ['penalty_pct'], label: 'Penalty %', type: 'number' },
        { path: ['from_tax_year'], label: 'From tax year', type: 'text' },
      ],
    },
    { key: 'two_pot', title: 'Two-pot', fields: [{ path: ['min_withdrawal'], label: 'Minimum withdrawal', type: 'number' }, { path: ['per_tax_year'], label: 'Withdrawals per tax year', type: 'number' }] },
    {
      key: 'bond_costs',
      title: 'Bond & transfer cost estimate',
      hint: 'Shown to people as an estimate.',
      fields: [
        { path: ['transferPct'], label: 'Transfer attorney % of price', type: 'number' },
        { path: ['bondPct'], label: 'Bond registration % of bond', type: 'number' },
        { path: ['fixed'], label: 'Fixed costs (R)', type: 'number' },
      ],
    },
    { key: 'assistant_daily_cap', title: 'Ask Loot daily cap', fields: [{ path: [], label: 'Questions a day', type: 'number' }] },
    { key: 'retirement_real_return_pct', title: 'Retirement real return', fields: [{ path: [], label: '% a year after inflation', type: 'number' }] },
    { key: 'shortcut_url', title: 'Apple Pay Shortcut link', hint: 'iCloud link to “Log to Loot” (docs/phase-6/SHORTCUT.md).', fields: [{ path: [], label: 'https://www.icloud.com/shortcuts/…', type: 'text' }] },
  ],
  seasons: [
    {
      key: 'seasons',
      title: 'Season dates',
      fields: [
        { path: ['black_friday'], label: 'Black Friday', type: 'date' },
        { path: ['black_friday_window_days_after'], label: 'Card shows for N days after', type: 'number' },
        { path: ['january_window', 'start'], label: 'Survive January card from (MM-DD)', type: 'text' },
        { path: ['january_window', 'end'], label: 'Survive January card until (MM-DD)', type: 'text' },
      ],
    },
  ],
}

function getAt(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

function setAt(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value
  const base = obj && typeof obj === 'object' ? { ...(obj as Record<string, unknown>) } : {}
  base[path[0]] = setAt(base[path[0]], path.slice(1), value)
  return base
}

/** /admin/content (§5.1): price changes, tax tables, limits & rates, seasons. Draft → publish with a reason. */
export function AdminContentPage() {
  const { data: me } = useAdminMe()
  const { data, isLoading, error } = useAdminContent()
  const [tab, setTab] = useState<Tab>('prices')
  const published = useMemo(() => Object.fromEntries((data?.settings ?? []).filter((s) => s.value !== null).map((s) => [s.key, s.value])), [data])
  const resolved = resolveContent(published)
  const stale = staleContent(resolved)
  const taxYear = getCurrentTaxYear()
  if (!published[`tax_tables:${taxYear}`] && data) stale.push(`No tax table published for ${taxYear} (the bundled one is used)`)

  return (
    <div className="animate-enter space-y-6" data-testid="admin-content">
      <PageHeader eyebrow="Admin · Controls" title="Content" subtitle="The rates and dates Loot uses. Draft, check, then publish with a reason. Bad values fall back to the built-in defaults." />
      {(stale.length > 0 || resolved.invalid.length > 0) && (
        <div className="card space-y-1.5 ring-2 ring-caution/40">
          {stale.map((s) => (
            <p key={s} className="flex items-center gap-2 text-[14px] text-caution">
              <AlertTriangle size={15} /> {s}
            </p>
          ))}
          {resolved.invalid.map((k) => (
            <p key={k} className="flex items-center gap-2 text-[14px] text-alert">
              <AlertTriangle size={15} /> {k} is published but invalid — people get the default
            </p>
          ))}
        </div>
      )}
      <div className="-mx-1 overflow-x-auto px-1 [&_button]:whitespace-nowrap">
        <Segmented
          label="Content"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'prices', label: 'Price changes' },
            { value: 'tax', label: 'Tax tables' },
            { value: 'limits', label: 'Limits & rates' },
            { value: 'seasons', label: 'Seasons' },
          ]}
        />
      </div>
      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">{error.message}</p>
      ) : isLoading || !data ? (
        <div className="skeleton h-80 rounded-[22px]" />
      ) : tab === 'prices' ? (
        <PriceEvents events={data.price_events} canWrite={roleAtLeast(me?.role, 'support')} />
      ) : tab === 'tax' ? (
        <TaxTables settings={data.settings} canWrite={roleAtLeast(me?.role, 'owner')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SETTINGS[tab].map((spec) => (
            <SettingCard key={spec.key} spec={spec} setting={data.settings.find((s) => s.key === spec.key)} canWrite={roleAtLeast(me?.role, contentMinRole(spec.key))} />
          ))}
        </div>
      )}
    </div>
  )
}

function SettingCard({ spec, setting, canWrite }: { spec: (typeof SETTINGS)['limits'][number]; setting: ContentSetting | undefined; canWrite: boolean }) {
  const actions = useContentActions()
  const fallback = (CONTENT_DEFAULTS as unknown as Record<string, unknown>)[spec.key]
  const base = setting?.draft ?? setting?.value ?? fallback
  const [value, setValue] = useState<unknown>(base)
  const [publishing, setPublishing] = useState(false)
  const check = resolveContent({ [spec.key]: value })
  const valid = !check.invalid.includes(spec.key)

  return (
    <AdminCard
      title={spec.title}
      sub={spec.hint}
      right={setting?.draft != null ? <span className="chip chip-caution">Draft</span> : setting?.value != null ? <span className="chip chip-positive">Published</span> : <span className="chip chip-neutral">Default</span>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {spec.fields.map((f) => (
          <div key={f.path.join('.') || spec.key}>
            <label className="field-label" htmlFor={`${spec.key}-${f.path.join('-')}`}>
              {f.label}
            </label>
            <input
              id={`${spec.key}-${f.path.join('-')}`}
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
              step="any"
              disabled={!canWrite}
              value={String(getAt(value, f.path) ?? '')}
              onChange={(e) => setValue((v: unknown) => setAt(v, f.path, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value))}
            />
          </div>
        ))}
      </div>
      {!valid && <p className="text-[13px] font-medium text-alert">These values don’t pass the checks (ranges / format), so they can’t be published.</p>}
      <div className="divide-y divide-hairline text-[13px]">
        <KV k="Published" v={setting?.published_at ? `${formatDate(setting.published_at, true)}${setting.published_by_email ? ` · ${setting.published_by_email}` : ''}` : 'Never (built-in default)'} />
      </div>
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={actions.saveDraft.isPending} onClick={() => actions.saveDraft.mutate({ key: spec.key, draft: value }, { onSuccess: () => toast.success('Draft saved') })} className="btn btn-secondary">
            Save draft
          </button>
          <button type="button" disabled={!valid || setting?.draft == null} onClick={() => setPublishing(true)} className="btn btn-primary">
            Publish draft
          </button>
          <ErrorNote error={actions.saveDraft.error} />
        </div>
      ) : (
        <p className="text-[12.5px] text-text-subtle">{contentMinRole(spec.key) === 'owner' ? 'Owners edit this.' : 'Support and Owners edit this.'}</p>
      )}
      {publishing && (
        <ActionDialog
          title={`Publish ${spec.title}?`}
          description={
            <div className="space-y-2 text-[13px]">
              <p>Everyone gets the new value within an hour.</p>
              <pre className="max-h-40 overflow-auto rounded-xl bg-fill p-3 whitespace-pre-wrap">Before: {JSON.stringify(setting?.value ?? fallback)}</pre>
              <pre className="max-h-40 overflow-auto rounded-xl bg-fill p-3 whitespace-pre-wrap">After: {JSON.stringify(setting?.draft)}</pre>
            </div>
          }
          confirmLabel="Publish"
          reasonRequired
          reasonPlaceholder="e.g. DMPR announcement 2 Dec"
          onConfirm={(reason) => actions.publish.mutateAsync({ key: spec.key, reason })}
          onClose={() => setPublishing(false)}
        />
      )}
    </AdminCard>
  )
}

const TEST_SALARIES = [15_000, 30_000, 60_000, 100_000]

function payeMonthly(gross: number, table: TaxTable) {
  return Math.max(0, computeGrossTax(gross * 12, table) - computeRebates(30, table)) / 12
}

function TaxTables({ settings, canWrite }: { settings: ContentSetting[]; canWrite: boolean }) {
  const actions = useContentActions()
  const years = [...new Set([...Object.keys(TAX_TABLES), ...settings.filter((s) => s.key.startsWith('tax_tables:')).map((s) => s.key.slice(11))])].sort().reverse()
  const [year, setYear] = useState(years[0])
  const setting = settings.find((s) => s.key === `tax_tables:${year}`)
  const bundled = TAX_TABLES[year] ?? TAX_TABLES[Object.keys(TAX_TABLES).sort().at(-1)!]
  const [table, setTable] = useState<TaxTable>((setting?.draft ?? setting?.value ?? bundled) as TaxTable)
  const [publishing, setPublishing] = useState(false)
  const valid = validateTaxTable(table) !== null

  function setBracket(i: number, patch: Partial<TaxBracket>) {
    setTable((t) => ({ ...t, brackets: t.brackets.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  }
  const num = (v: string) => (v === '' ? 0 : Number(v))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Tax year"
          className="!w-auto !min-w-[160px]"
          value={year}
          onValueChange={(y) => {
            setYear(y)
            const s = settings.find((x) => x.key === `tax_tables:${y}`)
            const t = (s?.draft ?? s?.value ?? TAX_TABLES[y] ?? bundled) as TaxTable
            setTable({ ...t, taxYear: y, label: TAX_TABLES[y]?.label ?? `1 Mar ${y.slice(0, 4)} – 28 Feb ${Number(y.slice(0, 4)) + 1}` })
          }}
          options={[...years, nextYear(years[0])].map((y) => ({ value: y, label: y }))}
        />
        {setting?.draft != null ? <span className="chip chip-caution">Draft</span> : setting?.value != null ? <span className="chip chip-positive">Published</span> : <span className="chip chip-neutral">Bundled table</span>}
      </div>
      <AdminCard title="Brackets" sub="Each bracket must start where the last one ends, and its base must equal the tax at that point.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground">
                <th className="pb-2">Above</th>
                <th className="pb-2">Up to</th>
                <th className="pb-2">Base tax</th>
                <th className="pb-2">Rate %</th>
              </tr>
            </thead>
            <tbody>
              {table.brackets.map((b, i) => (
                <tr key={i}>
                  <td className="pr-2 pb-2"><input disabled={!canWrite} type="number" value={b.above} onChange={(e) => setBracket(i, { above: num(e.target.value) })} aria-label={`Bracket ${i + 1} above`} /></td>
                  <td className="pr-2 pb-2"><input disabled={!canWrite} type="number" value={b.upTo ?? ''} placeholder="no limit" onChange={(e) => setBracket(i, { upTo: e.target.value === '' ? null : num(e.target.value) })} aria-label={`Bracket ${i + 1} up to`} /></td>
                  <td className="pr-2 pb-2"><input disabled={!canWrite} type="number" value={b.base} onChange={(e) => setBracket(i, { base: num(e.target.value) })} aria-label={`Bracket ${i + 1} base`} /></td>
                  <td className="pb-2"><input disabled={!canWrite} type="number" step="any" value={Math.round(b.rate * 10000) / 100} onChange={(e) => setBracket(i, { rate: num(e.target.value) / 100 })} aria-label={`Bracket ${i + 1} rate`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost !min-h-9 !text-[13px]" onClick={() => setTable((t) => ({ ...t, brackets: [...t.brackets, { above: t.brackets.at(-1)?.upTo ?? 0, upTo: null, base: 0, rate: 0.45 }] }))}>
              <Plus size={14} /> Add bracket
            </button>
            <button type="button" className="btn btn-ghost !min-h-9 !text-[13px]" disabled={table.brackets.length <= 2} onClick={() => setTable((t) => ({ ...t, brackets: t.brackets.slice(0, -1) }))}>
              <Trash2 size={14} /> Remove last
            </button>
          </div>
        )}
      </AdminCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="Rebates, thresholds, credits">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['rebates', 'primary', 'Primary rebate'],
                ['rebates', 'secondary', 'Secondary (65+)'],
                ['rebates', 'tertiary', 'Tertiary (75+)'],
                ['thresholds', 'under65', 'Threshold under 65'],
                ['thresholds', 'from65to74', 'Threshold 65–74'],
                ['thresholds', 'from75', 'Threshold 75+'],
                ['medicalCredit', 'member', 'Medical credit (member)'],
                ['medicalCredit', 'firstDependant', 'First dependant'],
                ['medicalCredit', 'additionalDependant', 'Each additional'],
              ] as const
            ).map(([group, k, label]) => (
              <div key={`${group}.${k}`}>
                <label className="field-label" htmlFor={`tt-${group}-${k}`}>{label}</label>
                <input
                  id={`tt-${group}-${k}`}
                  type="number"
                  disabled={!canWrite}
                  value={(table[group] as Record<string, number>)[k]}
                  onChange={(e) => setTable((t) => ({ ...t, [group]: { ...(t[group] as Record<string, number>), [k]: num(e.target.value) } }))}
                />
              </div>
            ))}
            <div>
              <label className="field-label" htmlFor="tt-ra">RA deduction cap</label>
              <input id="tt-ra" type="number" disabled={!canWrite} value={table.raDeductionCap} onChange={(e) => setTable((t) => ({ ...t, raDeductionCap: num(e.target.value) }))} />
            </div>
          </div>
        </AdminCard>
        <AdminCard title="Test calculator" sub={`Monthly PAYE (under 65) against the bundled ${bundled.taxYear} table.`}>
          <div className="divide-y divide-hairline">
            {TEST_SALARIES.map((g) => {
              const draft = valid ? payeMonthly(g, table) : NaN
              const ref = payeMonthly(g, bundled)
              const diff = draft - ref
              return (
                <KV
                  key={g}
                  k={`R${g.toLocaleString('en-ZA')} gross`}
                  v={valid ? `R${Math.round(draft).toLocaleString('en-ZA')} (${diff >= 0 ? '+' : ''}${Math.round(diff)} vs bundled)` : 'invalid table'}
                />
              )
            })}
          </div>
          {!valid && <p className="text-[13px] font-medium text-alert">The table doesn’t pass validation (gaps, order, or bases that don’t add up).</p>}
        </AdminCard>
      </div>
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!valid || actions.saveDraft.isPending} onClick={() => actions.saveDraft.mutate({ key: `tax_tables:${year}`, draft: { ...table, taxYear: year } }, { onSuccess: () => toast.success('Draft saved') })} className="btn btn-secondary">
            Save draft
          </button>
          <button type="button" disabled={!valid || setting?.draft == null} onClick={() => setPublishing(true)} className="btn btn-primary">
            Publish {year}
          </button>
          <ErrorNote error={actions.saveDraft.error} />
        </div>
      ) : (
        <p className="text-[12.5px] text-text-subtle">Only Owners edit tax tables.</p>
      )}
      {publishing && (
        <ActionDialog
          title={`Publish the ${year} tax table?`}
          description={<p>Every tax figure in Loot (Tax centre, salary planner, two-pot, Ask Loot) switches to this table within an hour. The test calculator above shows the difference.</p>}
          confirmLabel="Publish"
          reasonRequired
          reasonPlaceholder="e.g. Budget speech 2027, SARS table published"
          onConfirm={(reason) => actions.publish.mutateAsync({ key: `tax_tables:${year}`, reason })}
          onClose={() => setPublishing(false)}
        />
      )}
    </div>
  )
}

function nextYear(y: string): string {
  const start = Number(y.slice(0, 4)) + 1
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

const EMPTY_EVENT: Partial<AdminPriceEvent> = { kind: 'fuel', title: '', description: '', effective_on: '', category: 'transport', change_pct: null, change_amount: null, change_unit: null, region: 'all', source_url: '' }

function PriceEvents({ events, canWrite }: { events: AdminPriceEvent[]; canWrite: boolean }) {
  const actions = useContentActions()
  const [editing, setEditing] = useState<Partial<AdminPriceEvent> | null>(null)
  const [statusChange, setStatusChange] = useState<{ id: string; status: string; title: string } | null>(null)
  const { data: reach } = usePriceEventReach(editing?.category ?? null)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => e.effective_on >= today)
  const past = events.filter((e) => e.effective_on < today)

  function save() {
    if (!editing?.title || !editing.effective_on) return toast.error('Add a title and date.')
    if (editing.change_pct == null && editing.change_amount == null) return toast.error('Add a % or an amount.')
    actions.saveEvent.mutate(editing as Record<string, unknown>, {
      onSuccess: () => {
        toast.success('Saved as a draft')
        setEditing(null)
      },
    })
  }

  const row = (e: AdminPriceEvent) => (
    <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold">{e.title}</p>
        <p className="text-[12.5px] text-muted-foreground">
          {formatDate(e.effective_on)} · {CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS] ?? e.category} ·{' '}
          {e.change_pct != null ? `${e.change_pct}%` : `${e.change_amount}${e.change_unit === 'c/l' ? 'c/l' : ''}`} · {e.region}
        </p>
      </div>
      <span className={`chip ${e.status === 'published' ? 'chip-positive' : e.status === 'draft' ? 'chip-caution' : 'chip-neutral'}`}>{e.status}</span>
      {canWrite && (
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost !min-h-8 !px-2.5 !text-[13px]" onClick={() => setEditing(e)}>Edit</button>
          {e.status !== 'published' && <button type="button" className="btn btn-secondary !min-h-8 !px-2.5 !text-[13px]" onClick={() => setStatusChange({ id: e.id, status: 'published', title: e.title })}>Publish</button>}
          {e.status === 'published' && <button type="button" className="btn btn-ghost !min-h-8 !px-2.5 !text-[13px]" onClick={() => setStatusChange({ id: e.id, status: 'archived', title: e.title })}>Archive</button>}
        </div>
      )}
    </li>
  )

  return (
    <div className="space-y-4">
      {canWrite && !editing && (
        <button type="button" className="btn btn-primary" onClick={() => setEditing(EMPTY_EVENT)}>
          <Plus size={15} /> Add a price change
        </button>
      )}
      {editing && (
        <AdminCard title={editing.id ? 'Edit price change' : 'New price change'} sub={reach != null ? `Affects about ${reach} people (anyone with an expense in this category)` : undefined}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="pe-title">Title</label>
              <input id="pe-title" value={editing.title ?? ''} maxLength={100} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Fuel price adjustment" />
            </div>
            <div>
              <label className="field-label" htmlFor="pe-kind">Kind</label>
              <Select id="pe-kind" value={editing.kind ?? 'other'} onValueChange={(v) => setEditing({ ...editing, kind: v })} options={PRICE_EVENT_KINDS.map((k) => ({ value: k, label: k.replace('_', ' ') }))} />
            </div>
            <div>
              <label className="field-label" htmlFor="pe-date">Effective</label>
              <input id="pe-date" type="date" value={editing.effective_on ?? ''} onChange={(e) => setEditing({ ...editing, effective_on: e.target.value })} />
            </div>
            <div>
              <label className="field-label" htmlFor="pe-cat">Affected category</label>
              <Select id="pe-cat" value={editing.category ?? 'other'} onValueChange={(v) => setEditing({ ...editing, category: v })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
            </div>
            <div>
              <label className="field-label" htmlFor="pe-region">Region</label>
              <Select id="pe-region" value={editing.region ?? 'all'} onValueChange={(v) => setEditing({ ...editing, region: v as AdminPriceEvent['region'] })} options={[{ value: 'all', label: 'All' }, { value: 'inland', label: 'Inland' }, { value: 'coastal', label: 'Coastal' }]} />
            </div>
            <div>
              <label className="field-label" htmlFor="pe-pct">Change %</label>
              <input id="pe-pct" type="number" step="any" value={editing.change_pct ?? ''} onChange={(e) => setEditing({ ...editing, change_pct: e.target.value === '' ? null : Number(e.target.value), change_amount: null, change_unit: null })} />
            </div>
            <div>
              <label className="field-label" htmlFor="pe-amt">or change in cents per litre</label>
              <input id="pe-amt" type="number" step="any" value={editing.change_unit === 'c/l' ? (editing.change_amount ?? '') : ''} onChange={(e) => setEditing({ ...editing, change_amount: e.target.value === '' ? null : Number(e.target.value), change_unit: e.target.value === '' ? null : 'c/l', change_pct: null })} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="pe-src">Source link</label>
              <input id="pe-src" type="url" value={editing.source_url ?? ''} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} placeholder="https://" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="pe-desc">Notes for people</label>
              <textarea id="pe-desc" rows={2} maxLength={1000} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </div>
          <ErrorNote error={actions.saveEvent.error} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={actions.saveEvent.isPending} onClick={save}>Save draft</button>
          </div>
        </AdminCard>
      )}
      <AdminCard title="Upcoming">{upcoming.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nothing coming up.</p> : <ul className="divide-y divide-hairline">{upcoming.map(row)}</ul>}</AdminCard>
      {past.length > 0 && <AdminCard title="Past"><ul className="divide-y divide-hairline">{past.map(row)}</ul></AdminCard>}
      {statusChange && (
        <ActionDialog
          title={`${statusChange.status === 'published' ? 'Publish' : 'Archive'} “${statusChange.title}”?`}
          description={statusChange.status === 'published' ? 'People with an expense in this category will see it, and get a push 7 days before.' : 'It stops showing to people.'}
          confirmLabel={statusChange.status === 'published' ? 'Publish' : 'Archive'}
          reasonRequired
          onConfirm={(reason) => actions.setEventStatus.mutateAsync({ id: statusChange.id, status: statusChange.status, reason })}
          onClose={() => setStatusChange(null)}
        />
      )}
    </div>
  )
}

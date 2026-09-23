import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, Plus, Search, Trash2, Users, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import {
  useAddExpense,
  useDeleteExpensePermanently,
  useExpenses,
  useRestoreExpense,
  useSoftDeleteExpense,
  useUpdateExpense,
} from '@/hooks/useExpenses'
import { useHouseholdView } from '@/hooks/useHousehold'
import { categoryLabel } from '@/lib/categories'
import { monthlyEquivalent } from '@/lib/money'
import type { Expense, NewExpense } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export function ExpensesPage() {
  const search = useSearch({ strict: false }) as { add?: boolean }
  const navigate = useNavigate()
  const household = useHouseholdView()
  const { data: expenses = [], isLoading } = useExpenses()
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()
  const softDelete = useSoftDeleteExpense()
  const restore = useRestoreExpense()
  const hardDelete = useDeleteExpensePermanently()

  const [formState, setFormState] = useState<'add' | { edit: Expense } | null>(null)
  const [binOpen, setBinOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'fixed' | 'variable'>('all')
  const [confirmForever, setConfirmForever] = useState<Expense | null>(null)
  const formRef = useRef<HTMLElement>(null)

  // Deep link: /expenses?add=1 opens the add form inline, then tidies the URL so a refresh doesn't reopen it.
  useEffect(() => {
    if (search.add) {
      setFormState('add')
      void navigate({ to: '/expenses', search: {}, replace: true })
    }
  }, [search.add, navigate])

  // The form lives inline on the page rather than in a popup, so bring it into view when it opens —
  // otherwise opening "Edit" on a row far down the list would leave the form off-screen.
  useEffect(() => {
    if (formState) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [formState])

  const q = query.trim().toLowerCase()
  const matches = (e: Expense) =>
    !q || e.name.toLowerCase().includes(q) || categoryLabel(e.category).toLowerCase().includes(q)

  const { fixed, variable, removed } = useMemo(() => {
    const active = expenses.filter((e) => !e.deleted_at)
    return {
      fixed: active.filter((e) => e.is_fixed && matches(e)),
      variable: active.filter((e) => !e.is_fixed && matches(e)),
      removed: expenses.filter((e) => e.deleted_at),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, q])

  const householdFixed = household.rows.filter((r) => !r.expense.deleted_at && r.expense.is_fixed && matches(r.expense))
  const householdVariable = household.rows.filter((r) => !r.expense.deleted_at && !r.expense.is_fixed && matches(r.expense))

  const sum = (list: Expense[]) => list.reduce((total, e) => total + monthlyEquivalent(e), 0)
  const totalActive = expenses.filter((e) => !e.deleted_at)

  function handleAdd(values: NewExpense) {
    addExpense.mutate(values, {
      onSuccess: () => {
        setFormState(null)
        toast.success(`${values.name} added`)
      },
    })
  }

  function handleUpdate(id: string, values: NewExpense) {
    updateExpense.mutate(
      { id, patch: values },
      {
        onSuccess: () => {
          setFormState(null)
          toast.success('Expense updated')
        },
      },
    )
  }

  function handleRemove(expense: Expense) {
    softDelete.mutate(expense.id, {
      onSuccess: () =>
        toast(`${expense.name} removed`, {
          action: { label: 'Undo', onClick: () => restore.mutate(expense.id) },
          duration: 6000,
        }),
    })
  }

  function handleDeleteForever() {
    if (!confirmForever) return
    hardDelete.mutate(confirmForever.id, {
      onSuccess: () => {
        toast.success(`${confirmForever.name} deleted permanently`)
        setConfirmForever(null)
      },
    })
  }

  const isEmpty = !isLoading && totalActive.length === 0
  const noMatches = !isEmpty && q && fixed.length + variable.length + householdFixed.length + householdVariable.length === 0

  const fixedList = household.active ? householdFixed.map((r) => r.expense) : fixed
  const variableList = household.active ? householdVariable.map((r) => r.expense) : variable
  const allActive = household.active ? household.combinedExpenses : totalActive
  const fixedTotal = sum(allActive.filter((e) => e.is_fixed))
  const variableTotal = sum(allActive.filter((e) => !e.is_fixed))
  const grandTotal = fixedTotal + variableTotal

  const renderRows = (
    plain: Expense[],
    shared: typeof householdFixed,
    emptyText: string,
  ) => {
    if (household.active) {
      if (shared.length === 0) return <p className="py-3 text-[14px] text-muted-foreground">{emptyText}</p>
      return shared.map(({ expense, ownerLabel, isMine }) => (
        <ExpenseRow
          key={expense.id}
          expense={expense}
          ownerLabel={ownerLabel}
          readOnly={!isMine}
          onEdit={() => setFormState({ edit: expense })}
          onDelete={() => handleRemove(expense)}
          isPending={softDelete.isPending}
        />
      ))
    }
    if (plain.length === 0) return <p className="py-3 text-[14px] text-muted-foreground">{emptyText}</p>
    return plain.map((expense) => (
      <ExpenseRow
        key={expense.id}
        expense={expense}
        onEdit={() => setFormState({ edit: expense })}
        onDelete={() => handleRemove(expense)}
        isPending={softDelete.isPending}
      />
    ))
  }

  const group = (
    title: string,
    hint: string,
    list: Expense[],
    plain: Expense[],
    shared: typeof householdFixed,
    emptyText: string,
  ) => (
    <section className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="card-title">
          {title} <span className="ml-1 text-[13px] font-medium text-muted-foreground">{hint}</span>
        </h2>
        <span className="tnum text-[13px] font-semibold text-muted-foreground">{formatCurrency(sum(list))}/mo</span>
      </div>
      <div className="card !px-4 !py-2">
        <div className="divide-y divide-hairline">{renderRows(plain, shared, emptyText)}</div>
      </div>
    </section>
  )

  return (
    <div className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Expenses"
        subtitle="Everything you're committed to spending each month."
        actions={
          <>
            {household.available && (
              <button
                type="button"
                onClick={household.toggle}
                disabled={household.isToggling}
                aria-pressed={household.active}
                className={`btn !min-h-[38px] !px-3.5 !text-[13px] ${household.active ? 'btn-accent' : 'btn-secondary'}`}
              >
                <Users size={15} strokeWidth={2} />
                Household
              </button>
            )}
            <button type="button" onClick={() => setFormState('add')} className="btn btn-primary" data-tutorial="expenses-add">
              <Plus size={16} strokeWidth={2.4} />
              Add expense
            </button>
          </>
        }
      />

      {formState && (
        <section ref={formRef} className="card-elevated animate-enter scroll-mt-6 space-y-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">
              {formState === 'add' ? 'New expense' : 'Edit expense'}
            </h2>
            <button
              type="button"
              onClick={() => setFormState(null)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-fill text-muted-foreground hover:text-foreground"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="max-w-2xl">
          {formState === 'add' ? (
            <ExpenseForm key="add" onSubmit={handleAdd} onCancel={() => setFormState(null)} isSubmitting={addExpense.isPending} submitLabel="Add expense" />
          ) : (
            <ExpenseForm
              key={formState.edit.id}
              initial={formState.edit}
              onSubmit={(values) => handleUpdate(formState.edit.id, values)}
              onCancel={() => setFormState(null)}
              onDelete={() => {
                handleRemove(formState.edit)
                setFormState(null)
              }}
              isSubmitting={updateExpense.isPending}
              submitLabel="Save changes"
            />
          )}
          </div>
        </section>
      )}

      {isEmpty ? (
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
            <Wallet size={30} strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">Nothing tracked yet</h2>
            <p className="max-w-sm text-[14px] text-muted-foreground">
              Add your recurring costs and Loot will show your real monthly position.
            </p>
          </div>
          <button type="button" onClick={() => setFormState('add')} className="btn btn-primary">
            <Plus size={16} strokeWidth={2.4} /> Add your first expense
          </button>
        </div>
      ) : (
        <>
          <section className="card-elevated grid gap-5 sm:grid-cols-[1.2fr_2fr] sm:items-center sm:p-6">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">
                {household.active
                  ? `Household total${household.partnerNames.length > 0 ? ` · you + ${household.partnerNames.join(', ')}` : ''}`
                  : 'Monthly total'}
              </p>
              <p className="tnum mt-1 text-[40px] font-bold leading-none tracking-[-0.04em]">{formatCurrency(grandTotal)}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {allActive.length} expense{allActive.length === 1 ? '' : 's'}, monthly-equivalent
              </p>
            </div>
            <div>
              <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
                {fixedTotal > 0 && (
                  <span className="rounded-l-full" style={{ width: `${(fixedTotal / (grandTotal || 1)) * 100}%`, background: 'var(--chart-2)' }} />
                )}
                {variableTotal > 0 && (
                  <span className="rounded-r-full" style={{ width: `${(variableTotal / (grandTotal || 1)) * 100}%`, background: 'var(--chart-4)' }} />
                )}
              </div>
              <div className="mt-3 flex gap-8">
                <div className="text-[12.5px] text-muted-foreground">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-[1px]" style={{ background: 'var(--chart-2)' }} />
                  Fixed
                  <b className="tnum mt-0.5 block text-[15px] font-semibold text-foreground">{formatCurrency(fixedTotal)}</b>
                </div>
                <div className="text-[12.5px] text-muted-foreground">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-[1px]" style={{ background: 'var(--chart-4)' }} />
                  Variable
                  <b className="tnum mt-0.5 block text-[15px] font-semibold text-foreground">{formatCurrency(variableTotal)}</b>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search expenses"
                aria-label="Search expenses"
                className="!bg-surface !pl-10 shadow-[var(--shadow-card)]"
              />
            </div>
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'fixed', label: 'Fixed' },
                { value: 'variable', label: 'Variable' },
              ]}
            />
          </div>

          {noMatches ? (
            <div className="card py-10 text-center text-[14px] text-muted-foreground">
              No expenses match &ldquo;{query}&rdquo;.{' '}
              <button type="button" onClick={() => setQuery('')} className="font-semibold text-primary">
                Clear search
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-6 ${filter === 'all' ? 'lg:grid-cols-2' : ''}`}>
              {filter !== 'variable' &&
                group('Fixed', 'same every month', fixedList, fixed, householdFixed, 'No fixed expenses yet.')}
              {filter !== 'fixed' &&
                group('Variable', 'changes month to month', variableList, variable, householdVariable, 'No variable expenses yet.')}
            </div>
          )}
        </>
      )}

      {removed.length > 0 && (
        <section className="card">
          <button
            type="button"
            onClick={() => setBinOpen((v) => !v)}
            aria-expanded={binOpen}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <Trash2 size={16} strokeWidth={2} className="text-muted-foreground" />
              Recently removed
              <span className="chip chip-neutral !h-6">{removed.length}</span>
            </span>
            <ChevronDown
              size={18}
              className={`text-text-subtle transition-transform ${binOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {binOpen && (
            <div className="animate-enter mt-3 divide-y divide-hairline border-t border-hairline pt-2">
              {removed.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onRestore={() => restore.mutate(expense.id, { onSuccess: () => toast.success(`${expense.name} restored`) })}
                  onDeleteForever={() => setConfirmForever(expense)}
                  isPending={restore.isPending || hardDelete.isPending}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {confirmForever && (
        <ConfirmModal
          title="Delete permanently?"
          confirmLabel="Delete permanently"
          isPending={hardDelete.isPending}
          onConfirm={handleDeleteForever}
          onCancel={() => setConfirmForever(null)}
        >
          <p>
            <span className="font-semibold text-foreground">{confirmForever.name}</span> will be gone for good — this
            can't be undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}

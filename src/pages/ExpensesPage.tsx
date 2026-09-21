import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, Plus, Search, Users, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
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
import { monthlyEquivalent, totalMonthlyExpenses } from '@/lib/money'
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

  const [modal, setModal] = useState<'add' | { edit: Expense } | null>(null)
  const [binOpen, setBinOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmForever, setConfirmForever] = useState<Expense | null>(null)

  // Deep link: /expenses?add=1 opens the add dialog, then tidies the URL so a refresh doesn't reopen it.
  useEffect(() => {
    if (search.add) {
      setModal('add')
      void navigate({ to: '/expenses', search: {}, replace: true })
    }
  }, [search.add, navigate])

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
  const combinedTotal = totalMonthlyExpenses(household.combinedExpenses)

  function handleAdd(values: NewExpense) {
    addExpense.mutate(values, {
      onSuccess: () => {
        setModal(null)
        toast.success(`${values.name} added`)
      },
    })
  }

  function handleUpdate(id: string, values: NewExpense) {
    updateExpense.mutate(
      { id, patch: values },
      {
        onSuccess: () => {
          setModal(null)
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

  const renderRows = (
    plain: Expense[],
    shared: typeof householdFixed,
    emptyText: string,
  ) => {
    if (household.active) {
      if (shared.length === 0) return <p className="px-2 py-3 text-sm text-text-muted">{emptyText}</p>
      return shared.map(({ expense, ownerLabel, isMine }) => (
        <ExpenseRow
          key={expense.id}
          expense={expense}
          ownerLabel={ownerLabel}
          readOnly={!isMine}
          onEdit={() => setModal({ edit: expense })}
          onDelete={() => handleRemove(expense)}
          isPending={softDelete.isPending}
        />
      ))
    }
    if (plain.length === 0) return <p className="px-2 py-3 text-sm text-text-muted">{emptyText}</p>
    return plain.map((expense) => (
      <ExpenseRow
        key={expense.id}
        expense={expense}
        onEdit={() => setModal({ edit: expense })}
        onDelete={() => handleRemove(expense)}
        isPending={softDelete.isPending}
      />
    ))
  }

  return (
    <div className="animate-enter space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.025em]">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you're committed to spending, monthly-equivalent.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {household.available && (
            <button
              type="button"
              onClick={household.toggle}
              disabled={household.isToggling}
              aria-pressed={household.active}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                household.active
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={14} strokeWidth={1.75} />
              Household view
            </button>
          )}
          <button type="button" onClick={() => setModal('add')} className="btn btn-primary">
            <Plus size={16} strokeWidth={2} />
            Add expense
          </button>
        </div>
      </header>

      {household.active && (
        <div className="card-purple flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold">
            Combined household expenses{household.partnerNames.length > 0 && ` · you + ${household.partnerNames.join(', ')}`}
          </p>
          <p className="tnum text-lg font-bold">{formatCurrency(combinedTotal)}/mo</p>
        </div>
      )}

      {isEmpty ? (
        <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Wallet size={32} strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Nothing tracked yet.</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your recurring costs and Loot will show your real monthly position.
            </p>
          </div>
          <button type="button" onClick={() => setModal('add')} className="btn btn-primary">
            Add expense
          </button>
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses"
              aria-label="Search expenses"
              className="!pl-9"
            />
          </div>

          {noMatches ? (
            <div className="card py-10 text-center text-sm text-muted-foreground">
              No expenses match &ldquo;{query}&rdquo;.{' '}
              <button type="button" onClick={() => setQuery('')} className="font-semibold text-primary">
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="card space-y-1">
                <div className="mb-1 flex items-baseline justify-between px-2">
                  <div className="overline">Fixed</div>
                  <div className="tnum text-xs text-text-muted">
                    {formatCurrency(sum(household.active ? householdFixed.map((r) => r.expense) : fixed))}/mo
                  </div>
                </div>
                {renderRows(fixed, householdFixed, 'No fixed expenses yet.')}
              </section>

              <section className="card space-y-1">
                <div className="mb-1 flex items-baseline justify-between px-2">
                  <div className="overline">Variable</div>
                  <div className="tnum text-xs text-text-muted">
                    {formatCurrency(sum(household.active ? householdVariable.map((r) => r.expense) : variable))}/mo
                  </div>
                </div>
                {renderRows(variable, householdVariable, 'No variable expenses yet.')}
              </section>
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
            <span className="overline">Recently removed ({removed.length})</span>
            <ChevronDown
              size={16}
              className={`text-text-muted transition-transform ${binOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {binOpen && (
            <div className="mt-3 space-y-1 border-t border-hairline pt-3">
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

      {modal === 'add' && (
        <Modal title="Add expense" onClose={() => setModal(null)}>
          <ExpenseForm
            onSubmit={handleAdd}
            onCancel={() => setModal(null)}
            isSubmitting={addExpense.isPending}
            submitLabel="Add expense"
          />
        </Modal>
      )}

      {modal && typeof modal === 'object' && (
        <Modal title="Edit expense" onClose={() => setModal(null)}>
          <ExpenseForm
            initial={modal.edit}
            onSubmit={(values) => handleUpdate(modal.edit.id, values)}
            onCancel={() => setModal(null)}
            isSubmitting={updateExpense.isPending}
            submitLabel="Save changes"
          />
        </Modal>
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

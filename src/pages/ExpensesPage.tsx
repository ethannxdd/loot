import { ChevronDown, Plus, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { Modal } from '@/components/ui/Modal'
import {
  useAddExpense,
  useDeleteExpensePermanently,
  useExpenses,
  useRestoreExpense,
  useSoftDeleteExpense,
  useUpdateExpense,
} from '@/hooks/useExpenses'
import { useHouseholdExpenses, useMyHousehold } from '@/hooks/useHousehold'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import type { Expense, NewExpense } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export function ExpensesPage() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const { data: household } = useMyHousehold()
  const { data: expenses = [], isLoading } = useExpenses()
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()
  const softDelete = useSoftDeleteExpense()
  const restore = useRestoreExpense()
  const hardDelete = useDeleteExpensePermanently()

  const [modal, setModal] = useState<'add' | { edit: Expense } | null>(null)
  const [binOpen, setBinOpen] = useState(false)

  const householdViewOn = Boolean(profile?.household_view && household)
  const { rows: householdRows, combinedTotal } = useHouseholdExpenses(
    householdViewOn ? household!.members.map((m) => m.user_id) : [],
    expenses
  )

  const { fixed, variable, removed } = useMemo(() => {
    const active = expenses.filter((e) => !e.deleted_at)
    return {
      fixed: active.filter((e) => e.is_fixed),
      variable: active.filter((e) => !e.is_fixed),
      removed: expenses.filter((e) => e.deleted_at),
    }
  }, [expenses])

  const householdFixed = householdRows.filter((r) => !r.expense.deleted_at && r.expense.is_fixed)
  const householdVariable = householdRows.filter((r) => !r.expense.deleted_at && !r.expense.is_fixed)

  function handleAdd(values: NewExpense) {
    addExpense.mutate(values, { onSuccess: () => setModal(null) })
  }

  function handleUpdate(id: string, values: NewExpense) {
    updateExpense.mutate({ id, patch: values }, { onSuccess: () => setModal(null) })
  }

  const isEmpty = !isLoading && fixed.length === 0 && variable.length === 0

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
          {household && (
            <button
              type="button"
              onClick={() => updateProfile.mutate({ household_view: !profile?.household_view })}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                householdViewOn ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
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

      {householdViewOn && (
        <div className="card-purple flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold">Combined household expenses</p>
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
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card space-y-1">
            <div className="overline mb-1 px-2">Fixed</div>
            {householdViewOn ? (
              householdFixed.length === 0 ? (
                <p className="px-2 py-3 text-sm text-text-muted">No fixed expenses yet.</p>
              ) : (
                householdFixed.map(({ expense, ownerLabel, isMine }) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    ownerLabel={ownerLabel}
                    readOnly={!isMine}
                    onEdit={() => setModal({ edit: expense })}
                    onDelete={() => softDelete.mutate(expense.id)}
                    isPending={softDelete.isPending}
                  />
                ))
              )
            ) : fixed.length === 0 ? (
              <p className="px-2 py-3 text-sm text-text-muted">No fixed expenses yet.</p>
            ) : (
              fixed.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={() => setModal({ edit: expense })}
                  onDelete={() => softDelete.mutate(expense.id)}
                  isPending={softDelete.isPending}
                />
              ))
            )}
          </section>

          <section className="card space-y-1">
            <div className="overline mb-1 px-2">Variable</div>
            {householdViewOn ? (
              householdVariable.length === 0 ? (
                <p className="px-2 py-3 text-sm text-text-muted">No variable expenses yet.</p>
              ) : (
                householdVariable.map(({ expense, ownerLabel, isMine }) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    ownerLabel={ownerLabel}
                    readOnly={!isMine}
                    onEdit={() => setModal({ edit: expense })}
                    onDelete={() => softDelete.mutate(expense.id)}
                    isPending={softDelete.isPending}
                  />
                ))
              )
            ) : variable.length === 0 ? (
              <p className="px-2 py-3 text-sm text-text-muted">No variable expenses yet.</p>
            ) : (
              variable.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={() => setModal({ edit: expense })}
                  onDelete={() => softDelete.mutate(expense.id)}
                  isPending={softDelete.isPending}
                />
              ))
            )}
          </section>
        </div>
      )}

      {removed.length > 0 && (
        <section className="card">
          <button
            type="button"
            onClick={() => setBinOpen((v) => !v)}
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
                  onRestore={() => restore.mutate(expense.id)}
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
    </div>
  )
}

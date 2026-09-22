import { useState } from 'react'
import { toast } from 'sonner'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { useAddExpense } from '@/hooks/useExpenses'
import type { NewExpense } from '@/lib/types'

export function QuickAddExpense() {
  const addExpense = useAddExpense()
  const [formKey, setFormKey] = useState(0)

  function handleSubmit(values: NewExpense) {
    addExpense.mutate(values, {
      onSuccess: () => {
        setFormKey((k) => k + 1)
        toast.success(`${values.name} added`)
      },
    })
  }

  return (
    <div className="card space-y-3">
      <div className="overline-label">Quick-add expense</div>
      <ExpenseForm
        key={formKey}
        compact
        onSubmit={handleSubmit}
        isSubmitting={addExpense.isPending}
        submitLabel="Add"
      />
    </div>
  )
}

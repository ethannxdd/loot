import { createFileRoute } from '@tanstack/react-router'
import { ExpensesPage } from '@/pages/ExpensesPage'

export const Route = createFileRoute('/_app/expenses')({
  // `/expenses?add=1` opens the "Add expense" dialog straight away (used by "Add expense" buttons elsewhere).
  validateSearch: (search: Record<string, unknown>): { add?: true } => ({
    add: search.add === true || search.add === 'true' || search.add === 1 || search.add === '1' ? true : undefined,
  }),
  component: ExpensesPage,
})

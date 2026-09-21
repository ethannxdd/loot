import { createFileRoute } from '@tanstack/react-router'
import { StatementPage } from '@/pages/StatementPage'

export const Route = createFileRoute('/_app/statement')({
  component: StatementPage,
})

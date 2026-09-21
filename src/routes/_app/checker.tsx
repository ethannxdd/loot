import { createFileRoute } from '@tanstack/react-router'
import { CheckerPage } from '@/pages/CheckerPage'

export const Route = createFileRoute('/_app/checker')({
  component: CheckerPage,
})

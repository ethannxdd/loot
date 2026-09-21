import { createFileRoute } from '@tanstack/react-router'
import { GoalsPage } from '@/pages/GoalsPage'

export const Route = createFileRoute('/_app/goals/')({
  component: GoalsPage,
})

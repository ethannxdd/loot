import { createFileRoute } from '@tanstack/react-router'
import { PlannerPage } from '@/pages/PlannerPage'

export const Route = createFileRoute('/_app/planner')({
  component: PlannerPage,
})

import { createFileRoute } from '@tanstack/react-router'
import { TaxPage } from '@/pages/TaxPage'

export const Route = createFileRoute('/_app/tax')({
  component: TaxPage,
})

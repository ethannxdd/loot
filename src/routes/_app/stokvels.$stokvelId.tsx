import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { StokvelDetailPage } from '@/pages/StokvelDetailPage'

export const Route = createFileRoute('/_app/stokvels/$stokvelId')({
  beforeLoad: requireFlag('stokvels'),
  component: RouteComponent,
})

function RouteComponent() {
  const { stokvelId } = Route.useParams()
  return <StokvelDetailPage stokvelId={stokvelId} />
}

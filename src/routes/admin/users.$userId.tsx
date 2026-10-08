import { createFileRoute } from '@tanstack/react-router'
import { AdminUserPage } from '@/pages/admin/AdminUserPage'

export const Route = createFileRoute('/admin/users/$userId')({
  component: function UserRoute() {
    const { userId } = Route.useParams()
    return <AdminUserPage key={userId} userId={userId} />
  },
})

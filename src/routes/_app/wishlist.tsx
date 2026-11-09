import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { WishlistPage } from '@/pages/WishlistPage'

// Phase 6 — behind the `wishlist` flag.
export const Route = createFileRoute('/_app/wishlist')({
  beforeLoad: requireFlag('wishlist'),
  component: WishlistPage,
})

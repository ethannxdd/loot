import { Link } from '@tanstack/react-router'
import { Compass, RotateCcw } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

/** Shown for any URL that doesn't match a route — never a blank screen. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo size={40} />
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">That page doesn't exist</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The link may be old, or the page may have moved. Let's get you back to your loot.
        </p>
      </div>
      <Link to="/dashboard" className="btn btn-primary">
        <Compass size={16} strokeWidth={1.75} />
        Back to dashboard
      </Link>
    </div>
  )
}

/** Shown when a route throws while loading or rendering. */
export function ErrorPage({ error, reset }: { error: unknown; reset?: () => void }) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo size={40} />
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-2">
        {reset && (
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw size={16} strokeWidth={1.75} />
            Try again
          </button>
        )}
        <Link to="/dashboard" className="btn btn-ghost">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}

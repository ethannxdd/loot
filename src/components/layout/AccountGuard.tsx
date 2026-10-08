import { Download, Loader2, LogOut, UserX } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Logo } from '@/components/ui/Logo'
import { useAccountStatus, type AccountStatus } from '@/hooks/useAccountStatus'
import { useExportData } from '@/hooks/useAccountData'
import { useAuth } from '@/hooks/useAuth'
import { trackActivity } from '@/lib/activity'

/** `iat` (issued-at, seconds) from a JWT, or 0. */
function issuedAt(token: string | undefined): number {
  if (!token) return 0
  try {
    const part = token.split('.')[1] ?? ''
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')))
    return typeof payload.iat === 'number' ? payload.iat : 0
  } catch {
    return 0
  }
}

/**
 * Wraps the signed-in app:
 * - records today's visit (admin stats),
 * - signs this device out if an admin used "Sign out everywhere" after this session started,
 * - shows the suspended screen instead of the app while the account is suspended.
 *   (The database also makes a suspended account read-only, so this is the friendly face, not the lock.)
 */
export function AccountGuard({ children }: { children: ReactNode }) {
  const { user, session, signOut } = useAuth()
  const { data: status } = useAccountStatus()
  const signingOut = useRef(false)

  useEffect(() => {
    if (user?.id) void trackActivity(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!status?.sessions_revoked_at || signingOut.current) return
    const revokedAt = Date.parse(status.sessions_revoked_at) / 1000
    const iat = issuedAt(session?.access_token)
    if (iat && iat < revokedAt) {
      signingOut.current = true
      toast('You’ve been signed out', { description: 'Loot support ended all sessions on this account. Sign in again to continue.' })
      void signOut()
    }
  }, [status?.sessions_revoked_at, session?.access_token, signOut])

  if (status?.status === 'suspended') return <SuspendedScreen status={status} />
  return <>{children}</>
}

export function SuspendedScreen({ status }: { status: Pick<AccountStatus, 'reason' | 'suspended_until'> }) {
  const { signOut } = useAuth()
  const exportData = useExportData()
  const until = status.suspended_until
    ? new Date(status.suspended_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10" data-testid="suspended-screen">
      <div className="w-full max-w-[400px] space-y-6 text-center">
        <div className="flex justify-center">
          <Logo size={34} />
        </div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-alert/12 text-alert">
          <UserX size={28} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em]">Your account is suspended</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {until ? (
              <>
                You can’t use Loot until <span className="font-semibold text-foreground">{until}</span>.
              </>
            ) : (
              <>You can’t use Loot for now.</>
            )}{' '}
            Your data is safe, and you can still download a copy.
          </p>
        </div>
        {status.reason && (
          <div className="card text-left">
            <p className="field-label">Reason</p>
            <p className="text-[15px]">{status.reason}</p>
          </div>
        )}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => exportData.mutate(undefined, { onSuccess: () => toast.success('Export downloaded') })}
            disabled={exportData.isPending}
            className="btn btn-primary w-full !min-h-12 !text-[16px]"
          >
            {exportData.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download my data
          </button>
          <button type="button" onClick={() => void signOut()} className="btn btn-secondary w-full !min-h-12 !text-[16px]">
            <LogOut size={16} />
            Sign out
          </button>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Think this is a mistake? Contact Loot support and quote the email address you sign in with.
          </p>
        </div>
      </div>
    </div>
  )
}

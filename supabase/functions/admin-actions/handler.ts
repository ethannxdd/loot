// Loot — admin-actions — the logic, kept free of Deno and Supabase imports so it can be unit tested.
// index.ts wires it to the real Supabase admin client.

export type AdminRole = 'owner' | 'support' | 'viewer'

export type ActionName =
  | 'confirm_email'
  | 'send_password_reset'
  | 'send_magic_link'
  | 'sign_out_everywhere'
  | 'delete_user'

export interface ActionRequest {
  action?: unknown
  user_id?: unknown
  reason?: unknown
  /** delete_user only: the target's email, typed by the admin to confirm. */
  confirm_email?: unknown
  /** Where reset / sign-in links should land (the portal sends its own origin). */
  redirect_to?: unknown
}

export interface Caller {
  id: string
  email: string | null
  aal: string
}

export interface TargetUser {
  id: string
  email: string | null
  email_confirmed_at: string | null
}

export interface AuditEntry {
  admin_id: string
  admin_email: string | null
  action: ActionName
  target_user_id: string
  target_email: string | null
  reason: string | null
  details: Record<string, unknown>
}

/** Everything the handler needs from the outside world. */
export interface Deps {
  /** Verifies the session token and returns who it belongs to (null if invalid). */
  getCaller(token: string): Promise<Caller | null>
  getRole(userId: string): Promise<AdminRole | null>
  getUser(userId: string): Promise<TargetUser | null>
  confirmEmail(userId: string): Promise<void>
  sendPasswordReset(email: string, redirectTo: string | undefined): Promise<void>
  sendMagicLink(email: string, redirectTo: string | undefined): Promise<void>
  /** Returns how many sessions were ended (-1 if the database wouldn't let us; the app still signs them out). */
  revokeSessions(userId: string): Promise<number>
  deleteUser(userId: string): Promise<void>
  audit(entry: AuditEntry): Promise<void>
}

export interface Result {
  status: number
  body: Record<string, unknown>
}

const RANK: Record<AdminRole, number> = { viewer: 1, support: 2, owner: 3 }

const NEEDS: Record<ActionName, AdminRole> = {
  confirm_email: 'support',
  send_password_reset: 'support',
  send_magic_link: 'support',
  sign_out_everywhere: 'support',
  delete_user: 'owner',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (status: number, error: string): Result => ({ status, body: { error } })

/** Reads `aal` from a JWT payload. Only called after the token has been verified by Supabase. */
export function aalFromToken(token: string): string {
  try {
    const part = token.split('.')[1] ?? ''
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
    return (JSON.parse(json) as { aal?: string }).aal ?? 'aal1'
  } catch {
    return 'aal1'
  }
}

/** Turns Supabase Auth errors into something an admin can act on. */
export function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const status = (err as { status?: number } | null)?.status
  if (status === 429 || /rate limit|too many/i.test(message)) {
    return 'Supabase’s email limit was reached (the free plan allows only a few emails an hour). Try again later, or set up custom SMTP.'
  }
  if (/redirect/i.test(message)) {
    return 'Supabase rejected the link’s redirect address. Add your site URL under Authentication → URL Configuration.'
  }
  return message || 'Supabase couldn’t complete that. Nothing was changed.'
}

function cleanRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export async function handleAdminAction(token: string, body: ActionRequest, deps: Deps): Promise<Result> {
  if (!token) return fail(401, 'You need to be signed in.')
  const caller = await deps.getCaller(token)
  if (!caller) return fail(401, 'Your session is not valid. Sign in again.')

  const role = await deps.getRole(caller.id)
  const action = body.action as ActionName
  if (!role) return fail(403, 'not authorised')
  if (caller.aal !== 'aal2') return fail(403, 'two-factor required')
  if (typeof action !== 'string' || !(action in NEEDS)) return fail(400, 'Unknown action.')
  if (RANK[role] < RANK[NEEDS[action]]) return fail(403, 'not authorised')

  const userId = body.user_id
  if (typeof userId !== 'string' || !UUID.test(userId)) return fail(400, 'Missing or invalid user_id.')
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null

  const target = await deps.getUser(userId)
  if (!target) return fail(404, 'That account no longer exists.')

  const redirectTo = cleanRedirect(body.redirect_to)
  const details: Record<string, unknown> = {}

  try {
    switch (action) {
      case 'confirm_email':
        if (target.email_confirmed_at) return fail(409, 'This email is already confirmed.')
        await deps.confirmEmail(target.id)
        break
      case 'send_password_reset':
        if (!target.email) return fail(409, 'This account has no email address.')
        await deps.sendPasswordReset(target.email, redirectTo)
        break
      case 'send_magic_link':
        if (!target.email) return fail(409, 'This account has no email address.')
        await deps.sendMagicLink(target.email, redirectTo)
        break
      case 'sign_out_everywhere':
        details.sessions_ended = await deps.revokeSessions(target.id)
        break
      case 'delete_user': {
        if (target.id === caller.id) return fail(409, 'You can’t delete your own account from the portal.')
        if (await deps.getRole(target.id)) return fail(409, 'Remove this person from the admin team first.')
        if (!reason || reason.length < 3) return fail(400, 'Add a short reason — it goes in the audit log.')
        const typed = typeof body.confirm_email === 'string' ? body.confirm_email.trim().toLowerCase() : ''
        if (!target.email || typed !== target.email.toLowerCase()) {
          return fail(400, 'Type the account’s email exactly to confirm.')
        }
        // Log first: once the account is gone the audit entry is the only record of it.
        await deps.audit({
          admin_id: caller.id,
          admin_email: caller.email,
          action,
          target_user_id: target.id,
          target_email: target.email,
          reason,
          details,
        })
        await deps.deleteUser(target.id)
        return { status: 200, body: { ok: true } }
      }
    }
  } catch (err) {
    return fail(502, friendlyAuthError(err))
  }

  await deps.audit({
    admin_id: caller.id,
    admin_email: caller.email,
    action,
    target_user_id: target.id,
    target_email: target.email,
    reason,
    details,
  })
  return { status: 200, body: { ok: true, ...details } }
}

import { describe, expect, it, vi } from 'vitest'
import { aalFromToken, friendlyAuthError, handleAdminAction, type AdminRole, type Deps } from './handler.ts'

const OWNER = '11111111-1111-4111-8111-111111111111'
const SUPPORT = '22222222-2222-4222-8222-222222222222'
const VIEWER = '33333333-3333-4333-8333-333333333333'
const TARGET = '44444444-4444-4444-8444-444444444444'
const ROLES: Record<string, AdminRole> = { [OWNER]: 'owner', [SUPPORT]: 'support', [VIEWER]: 'viewer' }

function token(sub: string, aal = 'aal2') {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256' })}.${b64({ sub, aal })}.sig`
}

function deps(overrides: Partial<Deps> = {}) {
  const d: Deps = {
    getCaller: vi.fn(async (t: string) => {
      const sub = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub
      return { id: sub, email: `${sub.slice(0, 4)}@loot.test`, aal: aalFromToken(t) }
    }),
    getRole: vi.fn(async (id: string) => ROLES[id] ?? null),
    getUser: vi.fn(async (id: string) =>
      id === TARGET || id in ROLES ? { id, email: id === TARGET ? 'Target@Loot.test' : 'admin@loot.test', email_confirmed_at: null } : null,
    ),
    confirmEmail: vi.fn(async () => {}),
    sendPasswordReset: vi.fn(async () => {}),
    sendMagicLink: vi.fn(async () => {}),
    revokeSessions: vi.fn(async () => 3),
    deleteUser: vi.fn(async () => {}),
    audit: vi.fn(async () => {}),
    ...overrides,
  }
  return d
}

describe('admin-actions handler', () => {
  it('reads aal from the token', () => {
    expect(aalFromToken(token(OWNER, 'aal2'))).toBe('aal2')
    expect(aalFromToken('garbage')).toBe('aal1')
  })

  it('rejects missing or invalid sessions', async () => {
    expect((await handleAdminAction('', {}, deps())).status).toBe(401)
    const d = deps({ getCaller: vi.fn(async () => null) })
    expect((await handleAdminAction('x.y.z', {}, d)).status).toBe(401)
  })

  it('rejects people who are not admins, and admins without 2FA', async () => {
    const r1 = await handleAdminAction(token(TARGET), { action: 'confirm_email', user_id: TARGET }, deps())
    expect(r1).toEqual({ status: 403, body: { error: 'not authorised' } })
    const r2 = await handleAdminAction(token(OWNER, 'aal1'), { action: 'confirm_email', user_id: TARGET }, deps())
    expect(r2).toEqual({ status: 403, body: { error: 'two-factor required' } })
  })

  it('enforces roles per action', async () => {
    const d = deps()
    expect((await handleAdminAction(token(VIEWER), { action: 'send_password_reset', user_id: TARGET }, d)).status).toBe(403)
    expect((await handleAdminAction(token(SUPPORT), { action: 'delete_user', user_id: TARGET, reason: 'spam', confirm_email: 'target@loot.test' }, d)).status).toBe(403)
    expect(d.deleteUser).not.toHaveBeenCalled()
    expect((await handleAdminAction(token(SUPPORT), { action: 'send_password_reset', user_id: TARGET }, d)).status).toBe(200)
  })

  it('validates the action and user id', async () => {
    expect((await handleAdminAction(token(OWNER), { action: 'drop_tables', user_id: TARGET }, deps())).status).toBe(400)
    expect((await handleAdminAction(token(OWNER), { action: 'confirm_email', user_id: 'nope' }, deps())).status).toBe(400)
    const missing = '55555555-5555-4555-8555-555555555555'
    expect((await handleAdminAction(token(OWNER), { action: 'confirm_email', user_id: missing }, deps())).status).toBe(404)
  })

  it('confirms email, sends links with the redirect, and audits each', async () => {
    const d = deps()
    const r = await handleAdminAction(token(SUPPORT), { action: 'confirm_email', user_id: TARGET, reason: ' never got the email ' }, d)
    expect(r.status).toBe(200)
    expect(d.confirmEmail).toHaveBeenCalledWith(TARGET)
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'confirm_email', target_user_id: TARGET, reason: 'never got the email', admin_id: SUPPORT }))

    await handleAdminAction(token(SUPPORT), { action: 'send_password_reset', user_id: TARGET, redirect_to: 'https://loot.app/reset-password' }, d)
    expect(d.sendPasswordReset).toHaveBeenCalledWith('Target@Loot.test', 'https://loot.app/reset-password')
    await handleAdminAction(token(SUPPORT), { action: 'send_magic_link', user_id: TARGET, redirect_to: 'javascript:alert(1)' }, d)
    expect(d.sendMagicLink).toHaveBeenCalledWith('Target@Loot.test', undefined)
  })

  it('refuses to confirm an already-confirmed email', async () => {
    const d = deps({ getUser: vi.fn(async () => ({ id: TARGET, email: 't@loot.test', email_confirmed_at: '2026-01-01' })) })
    const r = await handleAdminAction(token(OWNER), { action: 'confirm_email', user_id: TARGET }, d)
    expect(r.status).toBe(409)
    expect(d.confirmEmail).not.toHaveBeenCalled()
  })

  it('signs out everywhere and reports how many sessions ended', async () => {
    const d = deps()
    const r = await handleAdminAction(token(SUPPORT), { action: 'sign_out_everywhere', user_id: TARGET }, d)
    expect(r).toEqual({ status: 200, body: { ok: true, sessions_ended: 3 } })
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ details: { sessions_ended: 3 } }))
  })

  it('delete_user needs owner, a reason and the typed email; logs before deleting', async () => {
    const order: string[] = []
    const d = deps({
      audit: vi.fn(async () => void order.push('audit')),
      deleteUser: vi.fn(async () => void order.push('delete')),
    })
    expect((await handleAdminAction(token(OWNER), { action: 'delete_user', user_id: TARGET, reason: 'spam' }, d)).status).toBe(400)
    expect((await handleAdminAction(token(OWNER), { action: 'delete_user', user_id: TARGET, confirm_email: 'target@loot.test' }, d)).status).toBe(400)
    const r = await handleAdminAction(token(OWNER), { action: 'delete_user', user_id: TARGET, reason: 'fake account', confirm_email: ' TARGET@loot.test ' }, d)
    expect(r.status).toBe(200)
    expect(order).toEqual(['audit', 'delete'])
  })

  it('will not delete yourself or another admin', async () => {
    const d = deps()
    expect((await handleAdminAction(token(OWNER), { action: 'delete_user', user_id: OWNER, reason: 'bye', confirm_email: 'admin@loot.test' }, d)).status).toBe(409)
    expect((await handleAdminAction(token(OWNER), { action: 'delete_user', user_id: SUPPORT, reason: 'bye', confirm_email: 'admin@loot.test' }, d)).status).toBe(409)
    expect(d.deleteUser).not.toHaveBeenCalled()
  })

  it('turns Supabase errors into clear messages and does not audit failures', async () => {
    const err = Object.assign(new Error('email rate limit exceeded'), { status: 429 })
    const d = deps({ sendPasswordReset: vi.fn(async () => { throw err }) })
    const r = await handleAdminAction(token(SUPPORT), { action: 'send_password_reset', user_id: TARGET }, d)
    expect(r.status).toBe(502)
    expect(r.body.error).toMatch(/email limit/)
    expect(d.audit).not.toHaveBeenCalled()
    expect(friendlyAuthError(new Error('Redirect URL not allowed'))).toMatch(/URL Configuration/)
  })
})

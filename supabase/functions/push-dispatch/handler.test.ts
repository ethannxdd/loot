import { describe, expect, it, vi } from 'vitest'
import { handlePushDispatch, sastDayStartIso, type DispatchDeps, type PendingNotification } from './handler.ts'

const SECRET = 's3cret-value'

function note(id: string, user = 'u1', kind = 'payday', created = '2026-11-09T05:00:00Z'): PendingNotification {
  return { id, user_id: user, kind, title: 'T', body: 'B', link: '/dashboard', created_at: created }
}

function deps(pending: PendingNotification[], over: Partial<DispatchDeps> = {}) {
  let nextId = 1
  const statuses = new Map<number, string>()
  const sends: { sub: string; payload: { tag: string } & Record<string, unknown> }[] = []
  const pushed: string[] = []
  const d: DispatchDeps = {
    cronSecret: SECRET,
    now: () => new Date('2026-11-09T06:00:00Z'), // 08:00 SAST
    flags: async () => ({ push: { global: true, overrides: new Map() } }),
    pending: async () => pending,
    prefs: async () => new Map([['u1', { pace: false }]]),
    subscriptions: async (ids) =>
      ids.map((u) => ({ id: `${u}-phone`, user_id: u, endpoint: 'https://push/1', p256dh: 'k', auth: 'a', platform: 'pwa' })),
    sentToday: async () => new Map(),
    logDelivery: vi.fn(async () => nextId++),
    setDeliveryStatus: vi.fn(async (id: number, s: string) => void statuses.set(id, s)),
    send: vi.fn(async (sub, payload) => {
      sends.push({ sub: sub.id, payload: payload as never })
      return 201
    }),
    deleteSubscription: vi.fn(async () => {}),
    markSubscription: vi.fn(async () => {}),
    markPushed: vi.fn(async (ids: string[]) => void pushed.push(...ids)),
    ...over,
  }
  return { d, sends, pushed, statuses }
}

describe('handlePushDispatch', () => {
  it('needs the cron secret', async () => {
    const { d } = deps([])
    expect((await handlePushDispatch('wrong', d)).status).toBe(401)
    expect((await handlePushDispatch(null, d)).status).toBe(401)
  })

  it('sends switched-on kinds and marks everything pushed', async () => {
    const { d, sends, pushed } = deps([note('n1'), note('n2', 'u1', 'pace')])
    const r = await handlePushDispatch(SECRET, d)
    expect(r.body).toMatchObject({ sent: 1, skipped: 1 })
    expect(sends).toHaveLength(1)
    expect(sends[0].payload).toMatchObject({ title: 'T', link: '/dashboard', d: 1 })
    expect(pushed.sort()).toEqual(['n1', 'n2'])
  })

  it('quiet hours: nothing is sent or marked, then it goes at 07:00', async () => {
    const { d, sends } = deps([note('n1')], { now: () => new Date('2026-11-09T20:00:00Z') }) // 22:00 SAST
    const r = await handlePushDispatch(SECRET, d)
    expect(r.body).toMatchObject({ quiet: true })
    expect(sends).toHaveLength(0)
    expect(d.markPushed).not.toHaveBeenCalled()
    const later = deps([note('n1', 'u1', 'payday', '2026-11-09T20:00:00Z')], { now: () => new Date('2026-11-10T05:00:00Z') })
    expect((await handlePushDispatch(SECRET, later.d)).body).toMatchObject({ sent: 1 })
  })

  it('caps automatic pushes at 3 a day; feedback replies are exempt', async () => {
    const { d, sends } = deps(
      [note('a', 'u2'), note('b', 'u2', 'budget_low'), note('c', 'u2', 'debit_orders'), note('d', 'u2', 'feedback_reply')],
      { sentToday: async () => new Map([['u2', 2]]) },
    )
    await handlePushDispatch(SECRET, d)
    expect(sends.map((s) => s.payload.tag)).toEqual(['payday', 'feedback_reply'])
  })

  it('push flag off → skipped', async () => {
    const { d, sends } = deps([note('n1')], { flags: async () => ({ push: { global: false, overrides: new Map() } }) })
    await handlePushDispatch(SECRET, d)
    expect(sends).toHaveLength(0)
  })

  it('404/410 deletes the subscription and logs expired', async () => {
    const { d, statuses } = deps([note('n1')], { send: vi.fn(async () => 410) })
    const r = await handlePushDispatch(SECRET, d)
    expect(r.body).toMatchObject({ expired: 1 })
    expect(d.deleteSubscription).toHaveBeenCalledWith('u1-phone')
    expect(statuses.get(1)).toBe('expired')
  })

  it('other errors log failed and keep the subscription', async () => {
    const { d, statuses } = deps([note('n1')], { send: vi.fn(async () => 500) })
    await handlePushDispatch(SECRET, d)
    expect(statuses.get(1)).toBe('failed')
    expect(d.deleteSubscription).not.toHaveBeenCalled()
  })

  it('SAST day start', () => {
    expect(sastDayStartIso(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-09T22:00:00.000Z')
    expect(sastDayStartIso(new Date('2026-11-09T21:59:00Z'))).toBe('2026-11-08T22:00:00.000Z')
  })
})

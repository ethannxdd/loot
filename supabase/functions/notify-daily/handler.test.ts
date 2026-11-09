import { describe, expect, it, vi } from 'vitest'
import { handleNotifyDaily, type ExtraCandidate, type NotifyDeps, type ProfileRow } from './handler.ts'

const SECRET = 'cron-secret-123'

const profile = (id: string, over: Partial<ProfileRow> = {}): ProfileRow => ({
  id,
  net_income: 30000,
  safety_buffer_pct: 10,
  currency_code: 'ZAR',
  payday_day: 25,
  payday_rule: 'previous_working_day',
  ...over,
})

const expense = (user_id: string, over: Record<string, unknown> = {}) => ({
  id: `e-${Math.random()}`,
  user_id,
  name: 'Rent',
  category: 'housing',
  amount: 9000,
  frequency: 'monthly',
  is_fixed: true,
  due_day: 25,
  deleted_at: null,
  ...over,
})

function deps(over: Partial<NotifyDeps> = {}) {
  const inserted: ExtraCandidate[] = []
  const d: NotifyDeps = {
    cronSecret: SECRET,
    // Tue 24 Nov 2026 05:00 UTC = 07:00 SAST; Wed 25 Nov is payday (and rent is due).
    now: () => new Date('2026-11-24T05:00:00Z'),
    flags: async () => ({
      live_cycle: { global: false, overrides: new Map([['live', true]]) },
      push: { global: false, overrides: new Map([['live', true], ['pushonly', true]]) },
    }),
    profiles: async (offset) => (offset === 0 ? [profile('live'), profile('pushonly'), profile('neither')] : []),
    expenses: async (ids) => ids.map((u) => expense(u)) as never,
    spendEntries: async () => [],
    insertNotifications: vi.fn(async (rows: ExtraCandidate[]) => {
      const fresh = rows.filter((r) => !inserted.some((i) => i.user_id === r.user_id && i.dedupe_key === r.dedupe_key))
      inserted.push(...fresh)
      return fresh.length
    }),
    ...over,
  }
  return { d, inserted }
}

describe('handleNotifyDaily', () => {
  it('needs the cron secret', async () => {
    const { d } = deps()
    expect((await handleNotifyDaily('nope', {}, d)).status).toBe(401)
  })

  it('debit orders tomorrow for push users; nothing for people with neither flag', async () => {
    const { d, inserted } = deps()
    await handleNotifyDaily(SECRET, { run: 'daily' }, d)
    expect(inserted.filter((n) => n.kind === 'debit_orders').map((n) => n.user_id).sort()).toEqual(['live', 'pushonly'])
    expect(inserted.find((n) => n.user_id === 'neither')).toBeUndefined()
    expect(inserted[0].body.replace(/\s/g, ' ')).toContain('R 9 000')
  })

  it('payday on the adjusted payday, live users only', async () => {
    const { d, inserted } = deps({ now: () => new Date('2026-11-25T05:00:00Z') })
    await handleNotifyDaily(SECRET, { run: 'daily' }, d)
    const payday = inserted.filter((n) => n.kind === 'payday')
    expect(payday.map((n) => n.user_id)).toEqual(['live'])
    expect(payday[0].dedupe_key).toBe('payday:2026-11-01')
  })

  it('running twice creates no duplicates', async () => {
    const { d, inserted } = deps()
    await handleNotifyDaily(SECRET, { run: 'daily' }, d)
    const n = inserted.length
    await handleNotifyDaily(SECRET, { run: 'daily' }, d)
    expect(inserted.length).toBe(n)
  })

  it('budget low at 80% from spend entries', async () => {
    const { d, inserted } = deps({
      expenses: async (ids) => ids.map((u) => expense(u, { category: 'groceries', amount: 3000, is_fixed: false, due_day: null })) as never,
      spendEntries: async () =>
        [{ id: 's', user_id: 'live', amount: 2500, category: 'groceries', spent_at: '2026-11-10T10:00:00Z', deleted_at: null }] as never,
    })
    await handleNotifyDaily(SECRET, { run: 'daily' }, d)
    const low = inserted.find((n) => n.kind === 'budget_low')
    expect(low?.user_id).toBe('live')
    expect(low?.dedupe_key).toBe('budget_low:groceries:2026-10-01:80')
  })

  it('weekly run only does pace', async () => {
    const { d, inserted } = deps({
      now: () => new Date('2026-11-15T16:00:00Z'),
      expenses: async (ids) => ids.map((u) => expense(u, { category: 'groceries', amount: 3000, is_fixed: false, due_day: null })) as never,
      spendEntries: async () =>
        [{ id: 's', user_id: 'live', amount: 100, category: 'groceries', spent_at: '2026-11-10T10:00:00Z', deleted_at: null }] as never,
    })
    await handleNotifyDaily(SECRET, { run: 'weekly' }, d)
    expect(inserted.map((n) => n.kind)).toEqual(['pace'])
    expect(inserted[0].body).toContain('ahead of pace')
  })

  it('extra generators get every user in the page', async () => {
    const extra = vi.fn(async () => [])
    const { d } = deps({ extras: [extra] })
    await handleNotifyDaily(SECRET, {}, d)
    expect((extra.mock.calls[0] as unknown[])[0]).toEqual(['live', 'pushonly', 'neither'])
  })
})

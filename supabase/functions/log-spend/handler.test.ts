import { describe, expect, it, vi } from 'vitest'
import { dedupeHashes, handleLogSpend, parseAmount, type LogSpendDeps } from './handler.ts'

const KEY = `loot_cap_${'ab'.repeat(24)}`
const USER = 'user-1'

function deps(over: Partial<LogSpendDeps> = {}) {
  const rows: Parameters<LogSpendDeps['insert']>[0][] = []
  const uses = { n: 0 }
  const d: LogSpendDeps = {
    now: () => new Date('2026-11-09T10:00:00Z'),
    useKey: vi.fn(async () => {
      uses.n++
      if (uses.n > 200) throw new Error('daily limit')
      return USER
    }),
    merchantCategory: vi.fn(async (_u: string, k: string) => (k === 'woolworths' ? 'groceries' : null)),
    hashExists: vi.fn(async (_u: string, hashes: string[]) => rows.some((r) => hashes.includes(r.external_hash))),
    insert: vi.fn(async (row) => {
      if (rows.some((r) => r.external_hash === row.external_hash)) return false
      rows.push(row)
      return true
    }),
    currency: vi.fn(async () => 'ZAR'),
    ...over,
  }
  return { d, rows }
}

describe('parseAmount', () => {
  it.each([
    ['R 1 234,50', 1234.5],
    ['ZAR1234.50', 1234.5],
    ['1234.5', 1234.5],
    ['R1,234.50', 1234.5],
    ['1.234,50', 1234.5],
    ['R85', 85],
    ['R 85,00', 85],
    ['1,234', 1234],
    [85.555, 85.56],
  ] as [unknown, number][])('%s → %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })

  it.each([['abc'], [''], [null]] as [unknown][])('%s is not an amount', (raw) => {
    expect(parseAmount(raw)).toBeNaN()
  })
})

describe('handleLogSpend', () => {
  it('logs with merchant memory and never stores the card', async () => {
    const { d, rows } = deps()
    const r = await handleLogSpend(`Bearer ${KEY}`, { amount: 'R 85,00', merchant: 'WOOLWORTHS', card: 'Visa 1234' }, d)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ ok: true, sorted: true })
    expect(String(r.body.logged).replace(/\s/g, ' ')).toBe('R 85 at WOOLWORTHS')
    expect(rows[0]).toMatchObject({ user_id: USER, amount: 85, category: 'groceries', source: 'apple_pay' })
    expect(JSON.stringify(rows[0])).not.toContain('Visa')
  })

  it('an unknown merchant goes to "To sort"', async () => {
    const { d, rows } = deps()
    await handleLogSpend(`Bearer ${KEY}`, { amount: 40, merchant: 'Corner cafe' }, d)
    expect(rows[0].category).toBeNull()
  })

  it('a malformed key is a 401 without touching the database', async () => {
    const { d } = deps()
    const r = await handleLogSpend('Bearer nope', { amount: 10 }, d)
    expect(r.status).toBe(401)
    expect(d.useKey).not.toHaveBeenCalled()
  })

  it('an unknown key is a 401', async () => {
    const { d } = deps({ useKey: vi.fn(async () => Promise.reject(new Error('invalid key'))) })
    expect((await handleLogSpend(`Bearer ${KEY}`, { amount: 10 }, d)).status).toBe(401)
  })

  it('the 201st call in a day is a 429', async () => {
    const { d } = deps()
    let last = 0
    for (let i = 0; i < 201; i++) {
      d.now = () => new Date(Date.parse('2026-11-09T06:00:00Z') + i * 300_000)
      last = (await handleLogSpend(`Bearer ${KEY}`, { amount: 10 + i, merchant: 'Shop' }, d)).status
    }
    expect(last).toBe(429)
  })

  it('identical merchant + amount within 2 minutes is a duplicate', async () => {
    const { d, rows } = deps()
    await handleLogSpend(`Bearer ${KEY}`, { amount: 85, merchant: 'Woolworths' }, d)
    d.now = () => new Date('2026-11-09T10:01:30Z')
    const r = await handleLogSpend(`Bearer ${KEY}`, { amount: 85, merchant: 'Woolworths' }, d)
    expect(r.body).toMatchObject({ ok: true, duplicate: true })
    expect(rows).toHaveLength(1)
    d.now = () => new Date('2026-11-09T10:06:00Z')
    await handleLogSpend(`Bearer ${KEY}`, { amount: 85, merchant: 'Woolworths' }, d)
    expect(rows).toHaveLength(2)
  })

  it('a bad amount is a 400', async () => {
    const { d } = deps()
    expect((await handleLogSpend(`Bearer ${KEY}`, { amount: '-5' }, d)).status).toBe(400)
    expect((await handleLogSpend(`Bearer ${KEY}`, { amount: 'free' }, d)).status).toBe(400)
  })

  it('uses a plausible transaction time and ignores future ones', async () => {
    const { d, rows } = deps()
    await handleLogSpend(`Bearer ${KEY}`, { amount: 5, merchant: 'A', at: '2026-11-09T09:30:00Z' }, d)
    await handleLogSpend(`Bearer ${KEY}`, { amount: 6, merchant: 'B', at: '2027-01-01T00:00:00Z' }, d)
    expect(rows[0].spent_at).toBe('2026-11-09T09:30:00.000Z')
    expect(rows[1].spent_at).toBe('2026-11-09T10:00:00.000Z')
  })

  it('dedupe hashes differ per user', async () => {
    const at = new Date('2026-11-09T10:00:00Z')
    expect((await dedupeHashes('a', 'x', 1, at))[0]).not.toBe((await dedupeHashes('b', 'x', 1, at))[0])
  })
})

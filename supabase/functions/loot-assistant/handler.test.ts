import { describe, expect, it, vi } from 'vitest'
import { handleAssistant, LIMIT_REPLY, sanitiseContents, type AssistantDeps } from './handler.ts'

const q = (text: string) => [{ role: 'user', parts: [{ text }] }]

function deps(over: Partial<AssistantDeps> = {}) {
  let used = 0
  const d: AssistantDeps = {
    useQuestion: vi.fn(async (_t: string, kind: string) => {
      if (kind === 'question') used++
      if (used > 30) throw new Error('daily limit reached')
      return 30 - used
    }),
    gemini: vi.fn(async () => ({ ok: true, status: 200, json: { candidates: [{ content: { role: 'model', parts: [{ text: 'You can.' }] } }] } })),
    ...over,
  }
  return d
}

describe('loot-assistant handler', () => {
  it('needs a token', async () => {
    expect((await handleAssistant(null, { contents: q('hi') }, deps())).status).toBe(401)
  })

  it('relays with tools and returns the reply', async () => {
    const d = deps()
    const r = await handleAssistant('Bearer t', { contents: q('Can I afford a R6,000 PS5?'), financialContext: 'Net R30 000' }, d)
    expect(r.body).toMatchObject({ reply: 'You can.', left: 29 })
    const sent = (d.gemini as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sent.tools[0].functionDeclarations.map((t: { name: string }) => t.name)).toContain('check_affordability')
    expect(sent.systemInstruction.parts[0].text).toContain('Net R30 000')
    expect(sent.systemInstruction.parts[0].text).toContain('Never calculate')
  })

  it('returns tool calls to the browser with the model content untouched', async () => {
    const parts = [{ functionCall: { name: 'check_affordability', args: { item: 'PS5', amount: 6000, recurring: false } }, thoughtSignature: 'sig' }]
    const d = deps({ gemini: vi.fn(async () => ({ ok: true, status: 200, json: { candidates: [{ content: { role: 'model', parts } }] } })) })
    const r = await handleAssistant('Bearer t', { contents: q('PS5?') }, d)
    expect(r.body.functionCalls).toEqual([{ name: 'check_affordability', args: { item: 'PS5', amount: 6000, recurring: false } }])
    expect(r.body.modelContent).toEqual({ role: 'model', parts })
  })

  it('acceptance: the 31st question in a day gets the limit message and no model call', async () => {
    const d = deps()
    let last: Awaited<ReturnType<typeof handleAssistant>> | null = null
    for (let i = 0; i < 31; i++) last = await handleAssistant('Bearer t', { kind: 'question', contents: q(`q${i}`) }, d)
    expect(last!.body).toEqual({ limit: true, reply: LIMIT_REPLY })
    expect((d.gemini as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(30)
  })

  it('continue requests are counted as calls, not questions', async () => {
    const d = deps()
    const contents = [
      ...q('PS5?'),
      { role: 'model', parts: [{ functionCall: { name: 'cycle_status', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'cycle_status', response: { safe_to_spend: 2000 } } }] },
    ]
    await handleAssistant('Bearer t', { kind: 'continue', contents }, d)
    expect(d.useQuestion).toHaveBeenCalledWith('t', 'continue')
  })

  it('rejects malformed or oversized conversations', () => {
    expect(sanitiseContents([])).toBeNull()
    expect(sanitiseContents([{ role: 'system', parts: [{ text: 'x' }] }])).toBeNull()
    expect(sanitiseContents([{ role: 'model', parts: [{ text: 'x' }] }])).toBeNull()
    expect(sanitiseContents(Array.from({ length: 41 }, () => ({ role: 'user', parts: [{ text: 'x' }] })))).toBeNull()
    expect(sanitiseContents([{ role: 'user', parts: [{ text: 'hi', inlineData: { data: 'x' } }] }])).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }])
  })

  it('a Gemini failure is a friendly 502', async () => {
    const d = deps({ gemini: vi.fn(async () => ({ ok: false, status: 500, json: null })) })
    expect((await handleAssistant('Bearer t', { contents: q('hi') }, d)).status).toBe(502)
  })
})

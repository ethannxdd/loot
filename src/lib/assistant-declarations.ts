/**
 * Ask Loot tools (Phase 6 §3.6, Rule 25) — Gemini function declarations. The model never calculates money itself: it
 * asks for one of these, the BROWSER runs it with the same src/lib functions the app uses (assistant-tools.ts), and
 * the model writes the answer from the result. Pure data — shared with the loot-assistant edge function.
 */

export interface ToolDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, { type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'INTEGER'; description: string; enum?: string[] }>
    required?: string[]
  }
}

export const ASSISTANT_TOOLS: ToolDeclaration[] = [
  {
    name: 'check_affordability',
    description: 'Can the user afford something? Uses Loot’s own affordability rules (safety buffer, disposable income, savings). Use for any "can I afford" question.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item: { type: 'STRING', description: 'What it is, e.g. "PS5"' },
        amount: { type: 'NUMBER', description: 'Price in rand' },
        recurring: { type: 'BOOLEAN', description: 'True if it is a monthly cost, false if once-off' },
      },
      required: ['item', 'amount', 'recurring'],
    },
  },
  {
    name: 'cycle_status',
    description: 'This pay cycle right now: Safe to spend, per day, days to payday, unplanned spend, overspend and budgets left.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'category_spend',
    description: 'How much the user spent in one category over recent cycles (from their spend log), plus their budget.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: 'Category key, e.g. groceries, eating_out, transport' },
        cycles: { type: 'INTEGER', description: 'How many recent cycles, 1–6' },
      },
      required: ['category'],
    },
  },
  {
    name: 'top_spending',
    description: 'Where the money went this cycle: logged spend per category, largest first. Use for "where did my money go".',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'goal_status',
    description: 'Progress on a savings goal by name (or all goals if no name).',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Goal name, optional' } } },
  },
  {
    name: 'what_if',
    description: 'How long the user’s savings would last in a scenario (runway).',
    parameters: {
      type: 'OBJECT',
      properties: {
        scenario: { type: 'STRING', description: 'The scenario', enum: ['lose_income', 'pay_cut', 'new_baby', 'custom'] },
        pay_cut_pct: { type: 'NUMBER', description: 'For pay_cut: percentage' },
        extra_monthly: { type: 'NUMBER', description: 'For new_baby/custom: extra monthly cost in rand' },
        other_income: { type: 'NUMBER', description: 'For lose_income: UIF or other income a month' },
      },
      required: ['scenario'],
    },
  },
  {
    name: 'tax_estimate',
    description: 'SARS income tax and take-home for a gross monthly salary (current tax year).',
    parameters: { type: 'OBJECT', properties: { gross_monthly: { type: 'NUMBER', description: 'Gross salary a month in rand' } }, required: ['gross_monthly'] },
  },
  {
    name: 'tfsa_room',
    description: 'Tax-free savings account room left this tax year and lifetime.',
    parameters: { type: 'OBJECT', properties: {} },
  },
]

export const ASSISTANT_TOOL_NAMES = ASSISTANT_TOOLS.map((t) => t.name)

/** Action chips the model can offer by ending its answer with [[action:<name>]] (one at most). */
export const ASSISTANT_ACTIONS = ['wishlist', 'log', 'planner', 'checker', 'tools'] as const
export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number]

/** Splits "[[action:wishlist]]" markers off an answer. */
export function extractActions(text: string): { text: string; actions: AssistantAction[] } {
  const actions: AssistantAction[] = []
  const clean = text
    .replace(/\[\[action:([a-z]+)\]\]/g, (_m, a: string) => {
      if ((ASSISTANT_ACTIONS as readonly string[]).includes(a) && !actions.includes(a as AssistantAction)) actions.push(a as AssistantAction)
      return ''
    })
    .trim()
  return { text: clean, actions }
}

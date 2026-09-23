export interface TutorialStep {
  id: string
  /** The page this step is shown on — the tour navigates there before measuring. */
  route: string
  /**
   * Elements to spotlight, in priority order: the first one found on screen wins (e.g. a page's action button,
   * falling back to its header when the page is in an empty state). Empty = centred card, no spotlight.
   */
  selectors: string[]
  title: string
  body: string
}

/**
 * The guided tour walks through the app page by page: each step opens its page, waits for the target to
 * render, then spotlights it with an instruction for what to do there. Targets are `data-tutorial`
 * attributes on each page (every PageHeader carries `data-tutorial="page-header"` as the fallback), so the
 * tour works on phones too — it never relies on the desktop sidebar being visible.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    route: '/dashboard',
    selectors: [],
    title: 'Welcome to Loot',
    body: 'A quick tour of each page and what to do there. It opens every page for you — skip any time, and replay it later from Settings → Help.',
  },
  {
    id: 'summary',
    route: '/dashboard',
    selectors: ['[data-tutorial="dashboard-stats"]', '[data-tutorial="page-header"]'],
    title: 'Your real number',
    body: 'This is what you actually have left this month after every commitment, not your bank balance. Check it before you spend.',
  },
  {
    id: 'quick-check',
    route: '/dashboard',
    selectors: ['[data-tutorial="dashboard-quick-actions"]'],
    title: 'Quick check',
    body: 'Thinking about buying something? Type it here for a straight answer without leaving your Summary.',
  },
  {
    id: 'expenses',
    route: '/expenses',
    selectors: ['[data-tutorial="expenses-add"]', '[data-tutorial="page-header"]'],
    title: 'Expenses',
    body: 'Tap “Add expense” for every recurring cost: rent, car, subscriptions, groceries. The more complete this is, the more accurate everything else becomes.',
  },
  {
    id: 'goals',
    route: '/goals',
    selectors: ['[data-tutorial="goals-add"]', '[data-tutorial="page-header"]'],
    title: 'Goals',
    body: 'Tap “Add goal” to save towards something (an emergency fund is a great first one). Loot tells you what to put away each month to hit it.',
  },
  {
    id: 'checker',
    route: '/checker',
    selectors: ['[data-tutorial="checker-form"]', '[data-tutorial="page-header"]'],
    title: 'Can I afford it?',
    body: 'Enter what you want to buy and whether it’s once-off or monthly. Loot weighs it against what’s left and your safety buffer.',
  },
  {
    id: 'statement',
    route: '/statement',
    selectors: ['[data-tutorial="statement-upload"]', '[data-tutorial="page-header"]'],
    title: 'Statements',
    body: 'Pick your bank and drop in a statement (PDF, CSV or OFX). Loot sorts every transaction into categories. It’s read on your device and never uploaded.',
  },
  {
    id: 'stats',
    route: '/stats',
    selectors: ['[data-tutorial="stats-tabs"]', '[data-tutorial="page-header"]'],
    title: 'Stats',
    body: 'Switch between these tabs to see your trend over time, spending by category, your net worth and how you compare.',
  },
  {
    id: 'planner',
    route: '/planner',
    selectors: ['[data-tutorial="planner-new"]', '[data-tutorial="page-header"]'],
    title: 'Salary planner',
    body: 'Tap “New plan” to model a job offer or raise after tax. Further down, add your debts to see when you’ll be debt-free.',
  },
  {
    id: 'compare',
    route: '/compare',
    selectors: ['[data-tutorial="compare-pick"]', '[data-tutorial="page-header"]'],
    title: 'Compare plans',
    body: 'Tap two to four saved plans to put them side by side. Green marks the better number in each row.',
  },
  {
    id: 'tax',
    route: '/tax',
    selectors: ['[data-tutorial="tax-summary"]', '[data-tutorial="page-header"]'],
    title: 'Tax centre',
    body: 'Your tax for the year, per month and your likely refund, from SARS tables. Add deductions below to see what they save you.',
  },
  {
    id: 'score',
    route: '/settings',
    selectors: ['#loot-score'],
    title: 'Loot Score',
    body: 'Rates your money habits. Add your real credit score from ClearScore or TransUnion here and Loot tracks an estimate on your bureau’s scale.',
  },
  {
    id: 'notifications',
    route: '/settings',
    selectors: ['button[aria-label="Notifications"]'],
    title: 'Notifications',
    body: 'Upcoming debits, tax deadlines and goal milestones show up here, so you don’t have to go looking.',
  },
  {
    id: 'finish',
    route: '/dashboard',
    selectors: [],
    title: 'You’re set',
    body: 'Start by adding your expenses. Loot takes it from there. Know your loot.',
  },
]

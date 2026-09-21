export interface TutorialStep {
  id: string
  /** CSS selector for the element to spotlight. Null renders a centred card with no spotlight. */
  selector: string | null
  title: string
  body: string
}

/**
 * The guided tutorial (Phase 5). Runs entirely on whatever authenticated page the user is
 * already on — Sidebar and NotificationBell are both mounted in AppLayout, so the tour never
 * needs to navigate the user away from what they were doing. The two Dashboard
 * steps use `data-tutorial` attributes added directly to DashboardPage.tsx; every other step
 * targets a stable, existing selector (nav links by `href`, buttons by `aria-label`) rather
 * than adding attributes across the whole codebase.
 *
 * If a step's selector isn't found on screen (e.g. the sidebar is hidden below the `md`
 * breakpoint on mobile), TutorialOverlay falls back to a centred card automatically — the
 * tour never breaks, it just loses the spotlight for that one step.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    selector: null,
    title: 'Welcome to Loot 👋',
    body: "Here's a two-minute tour of everything Loot can do for your money. Skip any time — you can replay this later from Settings → Help.",
  },
  {
    id: 'stats',
    selector: '[data-tutorial="dashboard-stats"]',
    title: 'Your real number',
    body: "These three cards are the heart of Loot: what's coming in, what's going out, and what you actually have left — your disposable income, not your bank balance.",
  },
  {
    id: 'quick-actions',
    selector: '[data-tutorial="dashboard-quick-actions"]',
    title: 'Quick actions',
    body: 'Run an affordability check before a purchase, see what debits are coming up, and add a new expense — all without leaving the Dashboard.',
  },
  {
    id: 'nav-expenses',
    selector: 'a[href="/expenses"]',
    title: 'Expenses',
    body: 'Every recurring cost you have, fixed and variable. Add, edit, or soft-delete — nothing is ever lost, it just moves to Recently removed.',
  },
  {
    id: 'nav-goals',
    selector: 'a[href="/goals"]',
    title: 'Goals',
    body: 'Set savings targets and track progress toward them, with milestone notifications along the way.',
  },
  {
    id: 'nav-checker',
    selector: 'a[href="/checker"]',
    title: 'Affordability Checker',
    body: 'Thinking about a purchase? Check it against your safety buffer before you commit — recurring or once-off.',
  },
  {
    id: 'nav-statement',
    selector: 'a[href="/statement"]',
    title: 'Statement Analysis',
    body: 'Upload an FNB or Capitec statement (PDF, CSV, or OFX) and Loot categorises every transaction — entirely in your browser. Raw transactions never touch our servers.',
  },
  {
    id: 'nav-planner',
    selector: 'a[href="/planner"]',
    title: 'Salary Planner & Debt Payoff',
    body: 'Model multi-phase income plans, then compare avalanche vs snowball debt strategies with a real payoff timeline.',
  },
  {
    id: 'nav-compare',
    selector: 'a[href="/compare"]',
    title: 'Compare Plans',
    body: 'Put two to four saved plans side by side and see exactly which one wins on tax, expenses, and leftover income.',
  },
  {
    id: 'nav-tax',
    selector: 'a[href="/tax"]',
    title: 'Tax Centre',
    body: "SARS-accurate tax estimates for the current year, a deduction tracker, your filing deadlines, and an eFiling guide tailored to your situation.",
  },
  {
    id: 'nav-stats',
    selector: 'a[href="/stats"]',
    title: 'Stats & History',
    body: 'Every month you close, tracked over time — plus your net worth across everything you own and owe.',
  },
  {
    id: 'nav-settings',
    selector: 'a[href="/settings"]',
    title: 'Settings',
    body: 'Your profile, your Loot Score with a real credit-health breakdown, and Household mode to link up with a partner.',
  },
  {
    id: 'notifications',
    selector: 'button[aria-label="Notifications"]',
    title: 'Notifications',
    body: 'Upcoming debits, tax deadlines, spending anomalies, goal milestones — Loot flags what matters here, without you having to go looking for it.',
  },
  {
    id: 'finish',
    selector: null,
    title: "You're set",
    body: "That's everything. Explore at your own pace — Loot's here whenever you need your number. Know your loot.",
  },
]

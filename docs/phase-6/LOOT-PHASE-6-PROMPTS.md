# Loot — Phase 6 Claude Code prompts (B1–B8)

> One prompt per batch. Paste **the shared preamble + one batch prompt** into Claude Code, opened in `~/Projects/loot`. Don't start a batch until the previous one is tested, approved and pushed.
> The plan and schema live in the repo at `docs/phase-6/` (copies of the project docs `claude/LOOT-PHASE-6.md` and `claude/LOOT-PHASE-6-SCHEMA.md`).

---

## Shared preamble (paste at the top of every batch)

```
You are building Phase 6 of Loot, a South African personal finance PWA (React 19 + TypeScript, Vite, TanStack Router file-based SPA, TanStack Query v5, Tailwind v4 with the v2 "Wallet" design system in src/styles.css, Motion, Recharts, Sonner, Supabase, Vercel).

Read first, fully: docs/phase-6/LOOT-PHASE-6.md (the plan — sections, decisions D1–D15, business rules 18–28) and docs/phase-6/LOOT-PHASE-6-SCHEMA.md (migration drafts). Then read the existing code you will touch before changing it.

House rules (do not break):
- Business logic lives in src/lib as pure, unit-tested functions. Existing lib files are carried forward unchanged unless a bug is found or this batch explicitly says to change them.
- Design: reuse PageHeader, StatStrip, Segmented, Switch/SwitchRow, InlineSheet, ConfirmModal, inset grouped lists, .card / .btn-* / .chip-* / .object-card classes and category colours from lib/categories.ts. Component classes go in @layer components. Light + dark must both work (tokens only, no hard-coded colours). Anything position:fixed that covers the screen is portalled to <body>.
- Inline add/edit forms (InlineSheet), Modal only for confirmations. Amounts use tabular digits.
- Every new feature is behind its feature flag via useFeature(key) (fails closed): routes redirect to /dashboard, nav items/cards/buttons hidden when off.
- Every new user table: RLS own-row, the three suspension policies (public.add_suspension_policies), on delete cascade, included in Settings → Your data export and Danger zone → Reset all data.
- Migrations are safe to run twice. Write them to supabase/migrations/0NN_<name>.sql. Refine the drafts if needed, but explain every deviation.
- Never cache Supabase responses in the service worker. Never send raw statement transactions anywhere.
- Copy: plain South African English, rands as "R 1 234" via the existing formatter, no exclamation marks, no emoji.

Verification you must run before saying you're done:
- npx tsc -b, npm run build, npm test (all existing tests stay green; add unit tests for every new lib function).
- Playwright interaction tests for this batch at 1440 and 390 widths, light and dark, with no horizontal overflow at 320/390/430 and no page errors.
- For each migration: an SQL test (real Postgres with Supabase-style roles, as used for Migration 025) proving another user can't read/write the rows, anon is refused, a suspended user is read-only, and admin functions need role + aal2.

When done, give me:
1. A list of every file created/changed/deleted.
2. Exactly what I must do by hand (SQL to run, secrets, CLI commands, Vercel env vars), as numbered steps.
3. How to test it myself on my laptop and iPhone (numbered, plain steps).
4. Known issues / anything you deviated from in the plan.
```

---

## B1 — Live Loot

```
BATCH B1 — Live Loot. Plan sections: §3.1, §3.2, §3.7, §3.8 (number roll + payday moment + budget bar animation), §4.3 (category only; the Stats insight comes in B3), §9 nav, D5, D6, D7, D9, D10, Rules 18–21. Migration 026.

Context: Summary is src/pages/DashboardPage.tsx with components in src/components/dashboard (AvailableLootHero, UpcomingDebits, ForecastCard, MonthlyCloseCard, QuickAddExpense…). Money maths: src/lib/money.ts, snapshot.ts, forecast.ts, verdict.ts. Nav: src/lib/nav.ts, Sidebar.tsx, MobileTabBar.tsx, MobileTopBar.tsx, MobileMenu.tsx. Onboarding: src/pages/OnboardingPage.tsx. Settings income: src/components/settings/IncomeSection.tsx. Snapshot keeping: components/layout/SnapshotKeeper.tsx. Tutorial: lib/tutorial-steps.ts.

Build:
1. supabase/migrations/026_live_loot.sql (payday columns, spend_entries, spend_merchant_rules, add_suspension_policies helper, live_cycle flag).
2. src/lib/sa-calendar.ts — SA public holidays for any year (fixed dates, Sunday→Monday, Good Friday + Family Day from Easter), isWorkingDay, previous/next working day. Tests for 2026–2028.
3. src/lib/cycle.ts — adjustedPayday(year, month, profile), cycleFor(date, profile) → {key 'YYYY-MM-01', start, end, daysTotal, daysLeft, label "Oct pay · 23 Oct – 24 Nov"}, cyclesBack(n). null payday_day = calendar month (identical to today's behaviour). Exhaustive tests (every rule, 29/30/31 clamps, Dec→Jan, leap years, today = payday, today = last day).
4. src/lib/spending.ts — budgetsFor(expenses), spendByCategory(entries, cycle), safeToSpend({disposable, buffer, budgets, entries, cycle, today}) → {safe, perDay, unplanned, over, overByCategory, budgetsLeft, state: 'ok'|'tight'|'over'}, paceFor(category, cycle, today), merchantKey(merchant). Tests.
5. Wire cycles in when live_cycle is on: Summary hero, daily allowance, Before payday (rework UpcomingDebits), Forecast, Monthly close (closes on payday; add the "Review spending" step), Briefing month labels, Stats month picker labels, notifications that reference "this month". With the flag off, everything behaves exactly as now.
6. Spend log: hooks/useSpendEntries.ts (TanStack Query, optimistic add with Undo, merchant rule upsert), components/spending/LogSpendSheet.tsx (keypad-first amount, merchant autocomplete, category chips with "R x left", Yesterday chip, Log another), opened from a + Log button in MobileTopBar, the hero, /spending and ?log=1 on any page.
7. /spending page (routes/_app/spending.tsx + pages/SpendingPage.tsx) per §3.2. Budgets card on Summary.
8. Hero rework per D6 + number roll (components/ui/AnimatedNumber.tsx, Motion spring, prefers-reduced-motion respected) + payday moment card (profiles.last_payday_seen).
9. Payday settings in IncomeSection + onboarding (payday on step 2, new step 3 "Your biggest debit orders" with 5 presets, buffer becomes step 4, live preview uses real Safe to spend). One-time "When do you get paid?" Summary card for existing users.
10. Nav per §9 (Spending in Money) and mobile tab bar per D7 (Summary, Spending, Expenses, Goals, Stats; Statements → menu). With live_cycle off, keep today's tabs.
11. family_support category (26th) in lib/categories.ts, expense form helper line, planner categories.
12. Tutorial: add a Spending step (shown only when the flag is on).

Constraints: don't change money.ts disposable maths (Rule 1) — Safe to spend is computed on top of it. Locked snapshots never change. Household view stays budget-only (D9). Don't touch the admin portal except that the new flag appears automatically.

Acceptance:
- With live_cycle off for a user, a full regression run shows no visible change.
- With it on: setting payday 25 + previous working day shows the correct cycle for every month of 2026–2027 (spot-check Dec 2026 and Apr 2027 in the UI); logging R85 at "Woolworths" in Groceries updates the hero, per-day, Budgets card and /spending immediately, Undo reverts all of them; the second Woolworths log pre-selects Groceries; overspending shows "Over by" and never a negative per-day.
- New onboarding saves payday + debit orders as fixed expenses with due_day and lands on a Summary with a non-zero Safe to spend.
- SQL suite: spend_entries/spend_merchant_rules isolated per user, suspended read-only.
```

---

## B2 — Server & push

```
BATCH B2 — Server & push. Plan sections: §3.3, §3.4, D12, D13, Rules 23. Migration 027.

Context: B1 is merged. PWA is vite-plugin-pwa 1.3.0 with generateSW in vite.config.ts; src/lib/pwa.ts handles updates. Notifications today are generated client-side in src/lib/notifications.ts with idempotent dedupe_key sync (hooks/useNotifications.ts, components/notifications/*). Settings sections live in src/components/settings. Existing edge functions: supabase/functions/{loot-assistant,delete-account,admin-actions}.

Build:
1. Help me set up the Supabase CLI first: give exact Windows commands to install/login/link, and how to deploy functions with it. From now on all edge functions deploy with the CLI.
2. supabase/migrations/027_push_capture.sql per the draft (no cron statements in the migration — put the Vault + cron SQL in supabase/sql/027_cron_setup.sql with placeholders and instructions).
3. Generate VAPID keys (script in scripts/), document the env vars (VITE_VAPID_PUBLIC_KEY; secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET) in .env.example and the README.
4. Switch the PWA to injectManifest with src/sw.ts: identical precache/runtime rules to today (verify the cache contents are unchanged), plus push + notificationclick (focus/open the link, call mark_push_clicked). Update flow (toast + Refresh) must still work.
5. src/lib/push.ts + hooks/usePush.ts: support detection (installed iPhone app vs Safari tab vs Android/desktop), subscribe from a user tap, save/remove push_subscriptions, per-device state.
6. Settings → Notifications rewritten per §3.4 (master switch per device, per-kind switches stored in profiles.notification_prefs, quiet-hours note, iPhone "Install Loot first" path).
7. supabase/functions/_shared/: cycle + sa-calendar + spending + notification-kind generators as pure modules shared with src/lib (one source of truth — import the same files or generate a copy at build with a script and a test that fails if they drift). Kinds: payday, debit_orders, pace (weekly run), budget_low. Other kinds are added by later batches.
8. supabase/functions/notify-daily (x-cron-secret, service role, paginated users, inserts notifications with dedupe_key) and supabase/functions/push-dispatch (sends unpushed notifications via @pushforge/builder, quiet hours, max 3/day, logs push_deliveries, deletes 404/410 subscriptions). Unit tests for the handlers like admin-actions has.
9. Apple Pay capture: create/revoke/status RPCs wired into Settings → Spending (flag apple_pay_capture) per §3.3; supabase/functions/log-spend (bearer capture key, sha256 lookup, 200/day, amount parsing for "R 1 234,50" / "ZAR1234.50" / "1234.5", 2-minute dedupe via external_hash, merchant rule category, returns {ok, logged}). Unit tests for parsing and dedupe.
10. Write docs/phase-6/SHORTCUT.md: exact steps for me to build the "Log to Loot" shortcut on my iPhone (Get Contents of URL POST, header Authorization: Bearer <key> from an Import Question, JSON body {amount, merchant, card, at}, Show Notification with the reply), then the Transaction automation, and how to share it as an iCloud link.
11. "To sort" handling on /spending for apple_pay entries without a category.
12. Data export / reset / delete cover push_subscriptions and capture_keys (export: platforms + dates only, never keys or endpoints).

Constraints: no email sending. Never cache Supabase in the SW. The bell must show exactly the same notifications as before plus the new kinds — no duplicates between client-generated and server-generated rows (shared dedupe keys).

Acceptance:
- Desktop Chrome: enable push, trigger notify-daily locally with a seeded debit order tomorrow → one bell notification + one push; clicking opens the right page and records clicked_at; running notify-daily twice creates no duplicates.
- Quiet hours: a notification created at 22:00 SAST is pushed at 07:00.
- log-spend: valid key → entry appears on /spending within one refetch; wrong key 401; 201st call in a day 429; identical call within 2 minutes → no duplicate.
- PWA suite from 2026-10-08 still 23/23 and the update flow still works.
- I get clear numbered steps for: CLI setup, extensions, secrets, cron SQL, deploying 3 functions, Vercel env var, and the Shortcut.
```

---

## B3 — People

```
BATCH B3 — People. Plan sections: §4.1 Stokvels, §4.2 Splits & IOUs, §4.3 Family support insight, D8, Rule 21. Migration 028.

Build:
1. supabase/migrations/028_people.sql per the draft, including the parent-ownership with-check on child tables.
2. src/lib/stokvel.ts (schedule of contributions, payout month/amount for rotating by position and for savings/grocery with optional interest, months to go, paid-in so far) and src/lib/splits.ts (equal/amount/share splitting with cent rounding that always sums to the total, balances per person, settle maths, request-message text). Tests.
3. Stokvels: /stokvels and /stokvels/$id pages per §4.1 (list, create sheet with type-specific fields, member order drag-reorder, contributions log, payout card), linked fixed expense (create/update/delete with the stokvel), once_off_income for the payout, Received → Add to this cycle (negative spend entry, source 'stokvel') or Put into a goal (goal contribution).
4. Summary: "Stokvel payout this cycle" line when relevant; Forecast includes expected once-off income as a separate, labelled item (not in Safe to spend).
5. Splits: /splits per §4.2 (create with live per-person amounts, I paid / someone else paid, optional full-amount spend entry, settle full/part → negative spend entry, per-person view, Open/Settled), Send request via Web Share API with clipboard fallback, ShapID field in Settings → Profile. Summary chip "Owed to you · You owe".
6. Notifications (add to _shared generators): stokvel contribution due (3 days), stokvel payout month, split reminder (unsettled > 7 days, weekly, max 3, respects reminders_sent).
7. Family support insight card on Stats → Categories per §4.3.
8. Nav: People group (Stokvels, Splits), flags stokvels / splits.

Constraints: no other people's phone numbers or emails are stored. Settling never deletes the original spend entry. Splits/stokvel rows are never visible to a household partner.

Acceptance:
- Rotating stokvel, R1,000/mo, 12 members, position 4, start Jan 2027 → payout Apr 2027 R12,000, linked R1,000 Savings expense appears in Expenses and Safe to spend drops by R1,000.
- Split R1,200 four ways where I paid, logged as spend → cycle spend +R1,200; settling 3 × R300 → net R300; rounding R100 three ways sums to R100.00 exactly.
- Data export/reset/delete cover all six tables. SQL suite green.
```

---

## B4 — Decide

```
BATCH B4 — Decide. Plan sections: §4.4 Wishlist, §4.5 Tools hub, §3.5 seasonal planners, Rule 22. Migration 029.

Build:
1. supabase/migrations/029_decide.sql.
2. src/lib/wishlist.ts (default cooling-off by price vs take-home, ready state, saved-by-not-buying) + tests.
3. /wishlist per §4.4 (waiting countdown ring, ready object-card with a fresh verdict via the existing affordability logic, Buy it → optional spend entry, Not yet → snooze 7 days, Drop it). Checker: "Add to wishlist instead" under Tight / Not recommended. Notification kind wishlist_ready in _shared.
4. src/lib/tools/{car-cost,rent-vs-buy,moving-out,runway,january,black-friday}.ts — pure functions with thorough tests (amortisation with balloon, break-even year, runway months with partial income, January stretch days). Defaults that depend on content (prime, fuel, transfer duty, bond costs, Black Friday date) come from a single src/lib/content-defaults.ts for now; B5 replaces the source with app_content() without changing the tool code.
5. /tools hub + six tool pages per the §4.5 table and §3.5: two-column workspace (inputs / results) on desktop, stacked on phones, Save scenario (saved_scenarios), Export via exportDocument (add export docs for each tool in components/export/ExportDocs.tsx), Add to planner phase, Run a check.
6. Seasonal Summary cards (Survive January 1 Nov–15 Jan, Black Friday 1 Nov–date+3) — read dates from content-defaults for now.
7. Nav: Wishlist in Money, Tools in Planning; flags wishlist / tools.

Constraints: tools never write expenses unless the user taps an explicit action. No tool stores outputs — only inputs.

Acceptance:
- Car: R300,000, 10% deposit, 72 months, 12.75%, 30% balloon → instalment and balloon match an independent amortisation calculation in the test to the cent; true cost includes fuel/insurance/etc.
- Wishlist: 48h item becomes ready after the clock is advanced in tests; verdict uses the numbers at ready time (change income in between and see a different verdict).
- Survive January with Dec payday 15 Dec and Jan payday 23 Jan shows 39 days and the right set-aside; creating the goal works.
- Exports render correctly light/dark. SQL suite green.
```

---

## B5 — Stay ahead

```
BATCH B5 — Stay ahead. Plan sections: §4.6 Renewals & prices, §4.8 Challenges, §5.1 (data model + app reading only; the admin UI comes in B7), D11, Rule 24. Migration 030.

Build:
1. supabase/migrations/030_stay_ahead.sql. Seed values only after verifying each against an official source (SARB prime rate, DMRE/DMPR fuel prices inland + coastal, SARS transfer duty, SARS tax tables from lib/tax/tax-tables.ts); list the source URL and date for every seeded value in your summary. Upcoming price events seeded as 'draft'.
2. src/lib/content.ts + hooks/useContent.ts: app_content() once, 1-hour cache, a validator per key (shape + ranges), fallback to content-defaults.ts per Rule 24. Replace B4's content-defaults usage with useContent everywhere (tool code unchanged).
3. src/lib/price-impact.ts: per-user impact of events (pct on category amount; c/l via fuel price and an estimated litres/month from the transport amount), plus the user's own increase_month/increase_pct. Tests.
4. Expenses: "Goes up every … by …%" fields in the expense form (prefilled from a matching event), chip on rows.
5. /renewals page per §4.6 (Coming up · Renewals · Price changes), renewal form, contract-end nudge; Summary "Coming up in costs" card. Notification kinds renewal (30 + 7 days) and price_change (7 days) in _shared.
6. Challenges: src/lib/challenges.ts (auto-check rules from spend entries, 52-week amounts normal/reverse, streaks) + tests; /challenges page per §4.8; end-of-challenge "Move R x into a goal"; auto-checks on open and in notify-daily; notification kind challenge.
7. Nav: Stay ahead group; flags renewals / challenges.

Constraints: price_events are read-only for users. Content failures must never break a page.

Acceptance:
- With app_settings emptied, every page still renders using bundled defaults; a malformed value is ignored.
- A published 5% medical aid event in January shows "~R x more a month" only for users with a medical_aid expense.
- No-spend weekend with no discretionary entries Sat–Sun auto-ticks both days; one Eating out entry breaks it.
- SQL suite: price_events drafts invisible to users; app_settings unreadable directly; app_content() works for authenticated, not anon.
```

---

## B6 — Future you + Ask Loot

```
BATCH B6 — Future you + Ask Loot. Plan sections: §4.7, §3.6, D3, D14, Rules 25, 27, 28. Migration 031.

Context: Ask Loot exists but is parked behind the assistant flag: supabase/functions/loot-assistant (Gemini, gemini-flash-latest), hooks/useAssistant.ts, lib/assistant-context.ts, pages/AssistantPage.tsx, components/layout/AssistantFab.tsx. Tax maths: lib/tax/tax-math.ts + tax-tables.ts.

Build:
1. supabase/migrations/031_future_you.sql.
2. Tax tables from content: lib/tax reads `tax_tables:<year>` through useContent with validation; bundled tables stay the fallback. Existing tax tests must pass unchanged; add tests for the content path.
3. src/lib/tfsa.ts (room per tax year/lifetime, warnings, monthly to max by 28 Feb), src/lib/retirement.ts (real-return projection, gap, +R500 effect), src/lib/two-pot.ts (marginal tax on withdrawal using tax-math, admin fee, net, future-value cost) + tests.
4. /future page per §4.7 (TFSA · Retirement · Two-pot), flag future_you.
5. Ask Loot rework: tool definitions (check_affordability, cycle_status, category_spend, goal_status, what_if, tax_estimate, tfsa_room) executed in the browser with src/lib; the edge function only relays to Gemini (function calling), calls use_assistant_question() first and returns a friendly limit message; updated context builder (no notes, no other people's names); suggested prompts; action chips; re-add the FAB + tutorial step behind the assistant flag.
6. Settings → Data shows Ask Loot usage today.

Constraints: the model must never be asked to compute money — every figure in an answer comes from a tool result. No other people's names (splits/stokvels) are sent to Gemini.

Acceptance:
- "Can I afford a R6,000 PS5?" returns the same verdict as the Checker for the same numbers.
- 31st question in a day returns the limit message; the cap changes when app_settings.assistant_daily_cap changes.
- TFSA: R40,000 contributed in 2026/27 shows R6,000 room and an 80% warning.
- Two-pot: R20,000 withdrawal for a R30,000/mo earner shows tax at the right marginal rate.
```

---

## B7 — Admin portal v2

```
BATCH B7 — Admin portal v2. Plan sections: §5 (all), §6, Rules 23, 26. Migration 032.

Context: the portal is src/pages/admin/*, components/admin/{AdminLayout,AdminTwoFactor,AdminUi}.tsx, lib/admin.ts, hooks/useAdmin.ts, routes/admin/*, supabase/migrations/025_admin_portal.sql (admin_require, admin_log, roles), supabase/functions/admin-actions. Plan + decisions of v1: claude/LOOT-ADMIN-PORTAL.md (I'll paste it if you need it).

Build:
1. supabase/migrations/032_admin_v2.sql with every function in the schema doc's table, following 025's patterns exactly (admin_require first, admin_log on every write, reasons where 025 requires them, revoke from anon). Replace admin_overview_stats and admin_user_detail (keep their existing outputs, add the new fields).
2. Nav per §5 (Insights / People / Engage / Controls; phone tabs Overview · Users · Inbox · Announce; badges: Users = needs attention, Inbox = unanswered).
3. /admin/content per §5.1 (four tabs, draft → publish with diff and reason, tax-table editor with validation + test calculator against the bundled table, staleness warnings, reach counts).
4. /admin/announcements per §5.2 (composer, audience builder with live reach, previews, send test to me, role split for large sends, stats). Extend push-dispatch to deliver announcements. App side: components/announcements/AnnouncementBanner.tsx on Summary (flag announcements_banner) + bell + push.
5. Feedback: user side per §5.3 (Settings → Support, mobile menu, error page "Report this", Your messages + replies; works while suspended, including from SuspendedScreen) and /admin/feedback + /admin/feedback/$id (inbox, thread, reply, internal notes, status/priority/assign, saved replies). feedback_reply notification.
6. /admin/analytics per §5.4 (five tabs, CSV export).
7. User page additions per §5.5, incl. admin-actions action test_push.
8. Feature flags page: show the Phase 6 flags with their batch name in the description.

Constraints: no money amounts anywhere in the portal (extend the existing privacy test to every new page and RPC output). Audit log stays append-only. Viewer can read everything but change nothing.

Acceptance:
- SQL security suite extended: every new admin_* function refuses anon, normal users, and aal1 admins; Viewer can't write; Support can't publish Owner-only keys or send to ≥ 50 people; the user-side feedback RPCs work while suspended; users can't read others' feedback or any notes.
- E2E: publish a fuel price → app shows new tool default after cache expiry; announcement to "installed app" segment reaches only those users (bell + banner + push), stats count seen/clicked; feedback round trip user → admin reply → user notification + unread badge → user reply.
- Analytics numbers match hand-computed fixtures.
```

---

## B8 — Trust & polish

```
BATCH B8 — Trust & polish. Plan sections: §3.8 (goal completion), §7 items 6–7, §10. No migration unless a fix needs one.

Build / check:
1. Statement parsers: I'll put redacted statements in test-fixtures/statements/ (git-ignored). Fix parsers until every transaction is parsed and totals reconcile; turn each into a synthetic regression fixture that contains no real data.
2. Google OAuth end-to-end in browser and inside the installed PWA (give me the exact Supabase + Google Cloud settings to check first).
3. Account deletion on production with a throwaway account — give me a step-by-step checklist and a SQL query to confirm nothing remains in any table (including every Phase 6 table).
4. Empty-state and dead-end sweep for every Phase 6 page (each has a helpful empty state with one clear action).
5. Goal completion moment (ring closes with a spring, Done state, navigator.vibrate(20) where supported).
6. Tutorial: steps for Spending, Wishlist, Tools, Stokvels (each only when its flag is on).
7. Landing page + README: add the new features (bento tiles for Safe to spend, Stokvels, Wishlist, Tools) with real-looking demo data; refresh README screenshots.
8. Full regression: every existing suite + all Phase 6 suites, mobile sweep at 375 light/dark, PWA suite, admin suites.
9. Write docs/phase-6/ROLLOUT.md: the order to switch flags on for everyone, what to watch in Analytics after each, and how to roll back (flag off).

Acceptance: everything green; the production smoke checklist completed by me; ROLLOUT.md written.
```

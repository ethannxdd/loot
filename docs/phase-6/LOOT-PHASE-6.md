# Loot — Phase 6 "Live Loot" (plan)

> **Status: planned 2026-10-22, not started.** Builds on everything in LOOT-BUILD-LOG.md (Phases 1–5, v2 "Wallet", PWA, Admin portal, Keep me signed in).
> Schema drafts: `claude/LOOT-PHASE-6-SCHEMA.md` (Migrations 026–032). Claude Code hand-offs: `claude/LOOT-PHASE-6-PROMPTS.md`.
> Design: everything follows LOOT-DESIGN-SYSTEM.md (v2 Wallet). No new tokens unless listed in §9.

---

## 0. What this phase is

Loot today answers "how much is left" from **what you planned**. Phase 6 makes it answer from **what's actually happening**, adds the features that make it distinctly South African, and gives the admin portal the tools to run a live product.

| Area | Items |
|---|---|
| **Enhancements** | Payday-to-payday months · Quick spend log + Safe to spend · Apple Pay auto-capture (iOS Shortcuts) · Push notifications · Seasonal planners (Survive January, Black Friday) · Ask Loot (Gemini, grounded) · Onboarding debit orders · Delight motion |
| **New features** | Stokvels · Splits & IOUs · Family support · Wishlist with cooling-off · True cost calculators (car, rent vs buy, moving out) · Runway / What if · Price increase calendar · Policies & renewals · TFSA & retirement (incl. two-pot calculator) · Challenges |
| **Admin portal v2** | Content manager · Announcements & push · Feedback & support inbox · Deeper analytics · User page additions |
| **Trust pass** | Real-statement parser fixes, Google OAuth end-to-end, production deletion check, empty states, tutorial + landing updates |

**Out of scope (Phase 7):** Home-screen widget (needs the Capacitor native build; iOS widgets need a Mac + Xcode, Ethan is on Windows — Android is possible first), alternate looks C "Rings" and D "Widgets", shared stokvels between Loot accounts, bank aggregator connections (rejected — breaks the privacy promise).

---

## 1. Decisions

| | Decision | Status |
|---|---|---|
| D1 | Build in **8 batches with review**, like v2 (B1–B8, §8). Each batch = one Claude Code prompt. | ✅ Ethan |
| D2 | Admin portal v2 includes **all four**: Content manager, Announcements & push, Feedback inbox, Deeper analytics. | ✅ Ethan |
| D3 | Ask Loot **stays on Gemini** (`gemini-flash-latest`). | ✅ Ethan |
| D4 | **Every new feature ships behind a feature flag**, off for everyone. Ethan turns each on for himself in Admin → Feature flags, tests on production, then switches it on for everyone. | Recommended |
| D5 | **Cycle label = the month you were paid in.** Paid Fri 23 Oct (the 25th is a Sunday) → "October", runs 23 Oct – 24 Nov (the day before the next payday, Wed 25 Nov). Snapshot key stays `YYYY-MM-01`, so all existing data, closes and charts keep working; users with no payday set stay on calendar months (identical to today). | Recommended |
| D6 | **Hero = Safe to spend** (free money after budgets, debit orders and the buffer). Remaining variable budgets ("Groceries R1,240 left") get their own card. The old "Available loot" plan number becomes a secondary line ("Planned: R x"). | Recommended |
| D7 | **Mobile tab bar:** Summary · Spending · Expenses · Goals · Stats. Statements moves to the menu (it's a monthly task). A **+ Log** button joins the mobile top bar and the hero. | Recommended |
| D8 | **Stokvels v1 are private tracking** — members are names, not Loot accounts. No phone numbers of other people are stored (POPIA). Shared stokvels = Phase 7. | Recommended |
| D9 | **Spend entries are private** — not shared with a household partner in v1 (household view stays on budgets). | Recommended |
| D10 | **Statements never write spend entries** (Business Rule 13 unchanged — no raw transactions stored from statements). Spend entries only come from the user typing or their own Shortcut. | Recommended |
| D11 | **SARS tax tables, TFSA limits, transfer duty, fuel prices, prime rate and season dates move to the Content manager.** The bundled tables in `lib/tax/tax-tables.ts` stay as the fallback, so the app never breaks if content is missing or invalid. | Recommended |
| D12 | **Push only, no email** (still no custom SMTP). Web push works in browsers and in the installed iPhone app (iOS 16.4+); it does not work in a normal iPhone Safari tab. | Recommended |
| D13 | **Supabase CLI from this phase on.** Edge functions now share code (`supabase/functions/_shared/`), which the dashboard editor can't deploy. | Recommended — Ethan to install |
| D14 | **Gemini paid tier before Ask Loot goes to everyone.** On Google's free tier, prompts can be used to improve Google's products — not acceptable for people's finances. Free tier is fine for Ethan-only testing. | Recommended — Ethan to enable billing |
| D15 | **Family support is a 26th expense category** (`family_support`), not a separate page. | Recommended |

---

## 2. Business rules added (continue LOOT-FEATURES.md numbering)

18. **Loot cycle.** `profiles.payday_day` null → calendar month. Otherwise the cycle starts on the *adjusted payday* in month M and ends the day before the adjusted payday in M+1. Adjusted payday: `payday_day` clamped to the month's length (31 → 30 Nov), then moved by `payday_rule`: `previous_working_day` (default — weekend or SA public holiday → the working day before), `next_working_day`, `exact`, or `last_working_day` (ignores `payday_day`). SA public holidays are computed in `lib/sa-calendar.ts` (fixed dates, Sunday → Monday rule, Good Friday / Family Day from Easter). Cycle key = `YYYY-MM-01` of M. Weekly/fortnightly earners: payday is still a monthly anchor (their income is already converted to monthly).
19. **Safe to spend** (cycle) = disposable income − safety buffer amount − unplanned spend − Σ overspend. *Unplanned spend* = spend entries in categories with no variable budget. *Overspend* per variable category = max(0, spent − budget). Refunds (negative entries) reduce spend. **Per day** = Safe to spend ÷ days left in the cycle (including today). Below zero → "Over by R x" state (alert colour), never a negative daily allowance.
20. **Budgets left** per variable category = max(0, budget − spent). Fixed-expense categories are hidden in the log sheet by default ("Debit orders are already counted"); logging into one is allowed but counted as unplanned.
21. **Spend entries** come only from manual logging, the user's own Shortcut, split settlements (negative = money back) and stokvel payouts the user adds to a cycle (negative). Challenge auto-checks only read them. Statements never create them (D10).
22. **Cooling-off.** A wishlist item becomes *ready* at `added_at + cool_off_days`. At ready time the affordability check (Rules 7/8) is re-run with the numbers on that day — never the numbers from when it was added.
23. **Push.** Sent only for kinds the user has switched on, never 21:00–07:00 SAST (queued to 07:00), max 3 automatic pushes per user per day (announcements count; replies to the user's own feedback don't).
24. **Content fallback.** Any content value (tax tables, limits, prices, seasons) that is missing, unpublished or fails validation falls back to the bundled default, and the admin Overview flags it.
25. **Ask Loot maths.** Every number in an Ask Loot answer comes from a tool call executed in the browser with the existing `src/lib` functions — the model never calculates money itself. Daily cap per user (default 30 questions, content-managed).
26. **Admin privacy (extended).** Announcement audiences, analytics and content reach counts never use money fields. Counts only. Feedback messages are shown to admins because the user wrote them to support.
27. **TFSA.** Annual limit R46,000 (from 1 March 2026, tax year 2026/27; was R36,000), lifetime R500,000, 40% penalty on excess — all content-managed. Warn at 80% and 100% of the annual limit.
28. **Two-pot.** Withdrawal from the savings component: minimum R2,000, once per tax year, taxed at the marginal rate (added to taxable income) plus an admin fee (user-entered). Content-managed minimum.

---

## 3. Enhancements

### 3.1 Payday-to-payday months (B1)

- **Settings → Monthly income** gains *Payday*: day picker (1–31 or "Last working day") + *If it falls on a weekend or public holiday* Segmented (Day before · Day after · Exact day). Live preview: "This cycle: 23 Oct – 24 Nov (33 days)".
- **Onboarding step 2** gains the same payday field (default 25th, previous working day).
- **Existing users** see a one-time Summary card: "When do you get paid?" → inline picker → saves; dismiss = stay on calendar months.
- Everything cycle-based switches to `lib/cycle.ts`: Summary hero, daily allowance, Coming up, Forecast, Monthly close (closes on payday, not the 1st), Briefing, Stats month picker labels ("Oct pay · 23 Oct – 24 Nov"), notifications.
- **Changing payday mid-cycle** shows a confirm: "Your current cycle will run 24 Oct – 31 Oct, then 1 Nov – …". The change applies from today's cycle; locked snapshots never move.

### 3.2 Quick spend log + Safe to spend (B1)

**Log sheet** (InlineSheet on desktop, bottom sheet on phones; opened from + Log in the top bar, the hero button, `/spending`, and `?log=1`):
- Amount first (big numeric keypad input, `inputmode="decimal"`), then merchant/note (free text with autocomplete from past entries), then category chips — the user's variable-budget categories first (with "R x left" under each), then "Something else" → full category Select.
- Date defaults to now; "Yesterday" chip; date picker.
- Save → toast "Logged R85 · Groceries R1,155 left" with Undo. Sheet stays open with "Log another".
- Merchant memory: the category picked for a merchant is remembered (`spend_merchant_rules`, see schema) and pre-selected next time.

**Summary hero (replaces AvailableLootHero content):**
- Label "Safe to spend", big number (number roll animation, §3.8), "R 312 a day · 9 days to payday".
- Secondary row: "Planned: R 4,200 · Spent unplanned: R 650 · Over budget: R 120" (only non-zero parts).
- Allocation bar now: Spent · Committed · Saving & growing · Left, of take-home.
- Over state: alert chip "Over by R 230", per-day line becomes "Ease off until payday".
- Buttons: **+ Log a spend** (ink), Household toggle unchanged (household totals use budgets only, D9).

**New Summary card "Budgets"** (replaces nothing, sits next to Coming up): each variable-budget category as a row with a thin progress bar (category colour), "R x left of R y", pace marker (where you *should* be today) — amber when ahead of pace, alert when over.

**Coming up → "Before payday":** fixed expenses with `due_day` inside the rest of the cycle, total at the top ("R 4,210 still to go off before payday"), grouped by date.

**`/spending` page (Money group):** PageHeader "Spending · Oct pay" + cycle picker; StatStrip (Spent this cycle · Unplanned · Budgets left · Per day); Budgets list (same as the card, full); entries as an inset grouped list by day (merchant, category tile, amount, source icon — hand / Apple Pay / split); tap = edit (amount, merchant, category, date, delete with Undo); filter Segmented All · Unplanned · Over budget · Auto-captured; "To sort" banner for auto-captured entries without a category.

**Monthly close** gains step "Review spending": cycle spend by category vs budget, with a one-tap "Raise Groceries budget to R x" suggestion when a category was over 2 cycles running.

### 3.3 Apple Pay auto-capture via iOS Shortcuts (B2)

- iOS 17+ Shortcuts has a **Transaction** automation: when a card in Apple Wallet is tapped, it passes card, merchant and amount and can run immediately without asking.
- **Settings → Spending → Log Apple Pay spends automatically** (shown on iPhone/iPad, explained elsewhere):
  1. *Create my capture key* → RPC returns a one-time key `loot_cap_…` (shown once, copy button; only its SHA-256 is stored).
  2. *Get the Loot shortcut* → iCloud link to a shortcut Ethan builds once (§7, B0) whose import question asks for the key.
  3. Steps with screenshots: Shortcuts → Automation → + → Transaction → pick cards → Run Immediately → add "Log to Loot" → done.
  4. Status: "Last capture: today 12:41 · 23 this cycle" · *Send a test* · *Turn off* (revokes the key).
- **`log-spend` edge function** (no JWT; key in header): looks up key hash, rate-limits (200/day), parses amount ("R 1 234,50", "ZAR1234.50"), dedupes identical merchant+amount within 2 minutes, inserts a spend entry with `source = 'apple_pay'`, category from `spend_merchant_rules` or null ("To sort"). Returns `{ ok, logged: "R85 at Woolworths" }` so the Shortcut can show a notification.
- Privacy copy (Settings + privacy policy): "Only the amount, the shop name and the time leave your phone — never your card or bank details."
- **Android:** no equivalent automation in Google Wallet; manual logging only. Shown as "Not available on Android yet".

### 3.4 Push notifications (B2)

- **Service worker** switches from `generateSW` to `injectManifest` with `src/sw.ts` (same precache rules as today + `push` and `notificationclick` handlers). Clicking a notification focuses/opens Loot at its link and marks it clicked.
- **Settings → Notifications** (replaces "Coming soon"): master switch *Push on this device* (requests permission from the tap; on an iPhone Safari tab it explains "Install Loot first" and links to Install Loot). Per-kind switches: Payday · Debit orders tomorrow · Weekly pace · Budgets running low · Wishlist ready · Renewals · Price increases · Stokvel turns · Splits reminders · Challenges · News from Loot (announcements). Quiet hours note (21:00–07:00).
- **Server-side generation:** `notify-daily` edge function, run by `pg_cron` every day at 05:00 UTC (07:00 SAST) plus a Sunday 18:00 SAST run for pace. It computes push-worthy notifications per user with shared pure modules and inserts them into `notifications` (same `dedupe_key` rule, so the bell and push never double up).
- **Sending:** `push-dispatch` edge function, every 5 minutes, pushes any un-pushed notification the user has switched on (`@pushforge/builder`, VAPID), holding anything that lands in quiet hours until 07:00 and applying the daily cap. Instant kinds (feedback replies, announcements) therefore arrive within 5 minutes. Expired subscriptions (404/410) are deleted; every send is logged in `push_deliveries`.
- **Kinds and copy:**

| Kind | When | Example |
|---|---|---|
| payday | Morning of the adjusted payday | "Payday. Your new loot: R 6,420 safe to spend this cycle." |
| debit_orders | Day before ≥1 fixed expense with `due_day` | "R 4,210 in debit orders go off tomorrow." |
| pace | Sunday 18:00 if logging this cycle | "You're R 340 ahead of pace this week." / "…behind pace" |
| budget_low | A variable budget hits 80% / 100% | "Groceries: R 220 left for 9 days." |
| wishlist_ready | Cooling-off ended | "Cooling-off's over for AirPods. Still want them?" |
| renewal | 30 and 7 days before `renews_on` | "Car insurance renews 14 Nov. Worth a quote?" |
| price_change | 7 days before an event affecting the user | "Petrol up ~R0.80/l on Wed — about R 96 more this month." |
| stokvel | 3 days before contribution / your payout month | "Your stokvel payout (R 12,000) is this month." |
| split | Unsettled share > 7 days, weekly, max 3 times | "Thabo still owes R 300 for Airbnb." |
| challenge | 07:00 on challenge days | "Day 2 of No-spend weekend — keep it going." |
| announcement | Admin send (§5.2) | as written by the admin |
| feedback_reply | Admin replied | "Loot support replied to your message." |

### 3.5 Seasonal planners (B4 — inside Tools, §4.5)

Seasonal cards appear on Summary only inside their content-managed window (Seasons, §5.1).

**Survive January** (`/tools/january`, card 1 Nov – 15 Jan):
- Inputs: December payday (date, prefilled from payday rule; Segmented "Same as usual · Paid early" with date), January payday, festive budget (gifts, travel, food — 3 fields + "other"), back-to-school list (fees, uniforms, stationery, transport — add rows), January debit orders (auto from expenses).
- Outputs: "Dec pay has to last **N days**" (vs usual), daily allowance across that stretch, **"Set aside R x from December pay"**, a stacked bar of where December pay goes. Buttons: *Create "January" goal* (target = set-aside, date = Dec payday), *Add festive budget as a spend category this cycle*.

**Black Friday** (`/tools/black-friday`, card from 1 Nov until the content-managed date + 3 days; 2026 date: **Fri 27 Nov**):
- Budget = Safe to spend on the day (projected) − anything the user ring-fences, with an optional "pause goal contributions this cycle" toggle that shows the cost ("delays Car deposit by 1 month").
- List = wishlist items tagged Black Friday, with target price; per item the affordability verdict; running total vs budget.
- After the date: "You spent R x of R y" from spend entries tagged during the weekend.

### 3.6 Ask Loot (B6)

- Re-enables `/assistant` + FAB behind the existing `assistant` flag (re-add the tutorial step).
- **Grounding:** the browser builds a compact context (income, cycle, Safe to spend, budgets left, goals, upcoming debits, wishlist, renewals — no names of other people, no notes) via an updated `lib/assistant-context.ts`.
- **Tools (Gemini function calling, executed in the browser):** `check_affordability(amount, recurring)` → `verdict.ts`; `cycle_status()`; `category_spend(category, cycles)`; `goal_status(name)`; `what_if(change)` → runway lib; `tax_estimate(gross)`; `tfsa_room()`. Edge function returns function calls; the client runs them and posts results back; the model writes the answer (Rule 25).
- **UI:** suggested prompts ("Can I afford a R 6,000 PS5?", "Where did my money go this cycle?", "How long would my savings last?"); answers can include an action chip (Add to wishlist · Log this · Open planner).
- **Limits:** `assistant_usage` daily cap (content-managed, default 30); friendly "That's it for today" state.

### 3.7 Onboarding: biggest debit orders (B1)

- New **step 3 "Your biggest debit orders"** (current buffer step becomes step 4): 5 preset rows (Rent or bond · Car · Insurance · Medical aid · Phone contract) each with amount + day, "+ Add another", Skip. Saved as fixed expenses with `due_day`.
- **Live preview panel** (desktop) and the final screen show the real Safe to spend from step 1, so the first Summary is never empty.

### 3.8 Delight (B1 + B8)

- **Number roll** on the hero and StatStrip values when they change (Motion spring; tabular digits; disabled under `prefers-reduced-motion`).
- **Payday moment:** first open in a new cycle → a full-width card at the top of Summary: "It's payday" + new Safe to spend counting up + last cycle in one line ("You finished October R 640 ahead"). Dismiss, never shown twice.
- **Goal completion:** ring closes with a spring + the card gets a "Done" state; `navigator.vibrate(20)` where supported (Android), Capacitor haptics later.
- **Logging feedback:** budget bar animates to its new width after a log.

---

## 4. New features

### 4.1 Stokvels (B3) — `/stokvels`, `/stokvels/$id`

- **List:** card per stokvel — name, type chip (Rotating · Savings · Grocery · Burial · Investment), "R 1,000 / month", next contribution date, *your payout* ("Your turn: Mar 2027 · R 12,000" or "Payout: 5 Dec · ~R 14,500").
- **Create (InlineSheet):** name, type, contribution amount + frequency (monthly default), contribution day, start month, number of members, **payout**: rotating → your position (or order list with names, drag to reorder); savings/grocery → payout date + expected interest % (optional). Toggle *Count my contribution as a monthly commitment* (default on) → creates a linked fixed expense (category Savings for savings/rotating/investment, Groceries for grocery, Insurance for burial; editable).
- **Detail:** StatStrip (Paid in so far · Your payout · Months to go); members list (names only, "you" highlighted, rotating order with paid-out ticks); **contributions log** (mark each month paid — one tap; late = caution chip); payout card.
- **Payout → planned income:** creates an `once_off_income` row for the payout month. It shows on Summary ("Stokvel payout this cycle: R 12,000") and Forecast, but is **not** in Safe to spend until the user taps *Received* → choose *Add to this cycle* (spend entry refund-style income) or *Put into a goal* (contribution).
- Notifications: contribution due (3 days), payout month.

### 4.2 Splits & IOUs (B3) — `/splits`

- **Create:** title, total, date, who paid (*I paid* · *Someone else paid*), people (name chips with autocomplete from past splits; *me* included by default), split Segmented (Equal · Amounts · Shares). Live per-person amounts.
- *I paid* → optional *Log the full R 1,200 as a spend* (default on, category picker). Each friend's share becomes "owed to me".
- *Someone else paid* → my share becomes "I owe" and optionally a spend entry for my share when I settle.
- **Request money:** per person *Send request* → share sheet (Web Share API, copy fallback) with text: "Hi Thabo — your share for Airbnb is R 300. PayShap: {my ShapID}. Thanks!" (ShapID saved once in Settings → Profile, optional).
- **Settle:** tap person → *Paid* (full/part). Settling money owed to me creates a **negative spend entry** (refund) so the cycle nets out to my share.
- **Summary chip:** "Owed to you R 900 · You owe R 150" (links to /splits). Not counted in Safe to spend until settled.
- List groups: Open · Settled; per person view ("Thabo: owes you R 300 across 2 splits").

### 4.3 Family support (B3)

- New category `family_support` ("Family support", giving family colour/icon `HeartHandshake`) in `lib/categories.ts`, the expense form, statement categorisation keywords (none by default — transfers are personal), planner categories, benchmarks bracket list.
- **Stats → Categories:** when the user has any family support, a card "Family support: 14% of take-home · R 2,800/mo", 12-cycle trend, and a gentle line comparing to their savings rate. No judgement copy.
- Expense form: when picked, a helper line "Money you send to parents, siblings or other family".

### 4.4 Wishlist with cooling-off (B4) — `/wishlist`

- **Add:** name, price, link (optional), category, cooling-off Segmented (**48 hours** · 7 days · 30 days; default 48h under R 1,000, 7 days above, 30 days above 10% of take-home — editable), tag *Black Friday* (Nov only).
- **Waiting:** card with a countdown ring ("Ready in 2 days"), price, *Buy now anyway* (asks "Skip the cooling-off?") and *Drop it*.
- **Ready:** dark object-card (same as the checker) showing the fresh verdict + reasoning (Rule 22) and three actions: *Buy it* (logs the spend, optional) · *Not yet* (snooze 7 days) · *Drop it*.
- **Saved by not buying:** header StatStrip — Waiting · Ready · **Dropped: R 4,350 not spent** (all time) — the delight number.
- The Checker gets *Add to wishlist instead* under a Tight / Not recommended verdict.

### 4.5 Tools hub (B4) — `/tools`

Grid of tool cards (icon tile, title, one line, last saved scenario). Every tool: inputs left / results right on desktop, stacked on phones; *Save scenario* (named, `saved_scenarios`), *Export* (PNG/PDF via `exportDocument`), *Add to planner phase*, *Run a check*. Pure maths in `src/lib/tools/*.ts` with unit tests.

| Tool | Inputs | Outputs |
|---|---|---|
| **True cost of a car** `/tools/car` | Price, deposit, term (12–96 mo), rate (prefilled prime + 2%, editable), balloon %, insurance/mo, km/month, fuel use l/100km, fuel price (content, inland/coastal Segmented), service plan yes/no or R/yr, tyres R/yr, licence + tracking R/yr | Instalment vs **true monthly cost** (stacked bar), total paid over term, total interest, **balloon owed at month N** (alert card), affordability verdict, "you'd need R x gross" (reuses `grossForNetSars`) |
| **Rent vs buy** `/tools/rent-vs-buy` | Price, deposit, bond rate, term (20/30), transfer duty (auto, content table), bond + transfer attorney costs (content estimate, editable), rates & levies, insurance, maintenance %/yr, current rent, rent escalation (default 8%), return on invested deposit, years to compare | Upfront cash needed, monthly cost buy vs rent, **break-even year** (line chart of cumulative cost / equity), verdict line |
| **Moving out** `/tools/moving-out` | Rent, deposit (months), utilities, internet, groceries for 1/2, transport, once-off furniture/appliances | Monthly cost, upfront cash, "you need to earn R x gross", gap vs current take-home |
| **Runway / What if** `/tools/runway` | Liquid savings (prefilled from net worth cash/savings items + emergency goal), essentials vs cuttable expenses (toggles per expense), scenario Segmented: Lose my income · Pay cut % · New baby · Custom; UIF/other income during (user-entered) | **Months of runway**, date the money runs out, balance chart, "Cutting X, Y buys you N more months" |
| **Survive January** | §3.5 | §3.5 |
| **Black Friday** | §3.5 | §3.5 |

### 4.6 Price increase calendar + Policies & renewals (B5) — `/renewals`

One page "Renewals & prices", Segmented **Coming up · Renewals · Price changes**.

- **Price changes (global, content-managed):** events like *Fuel (monthly, first Wednesday)*, *Municipal electricity & water (July)*, *Medical aid (January)*, *Short-term insurance*, *Cellphone contracts*, *Eskom direct (April)*. Each: date, kind, affected category, change (% or c/l), region, source link. **Per user:** estimated impact = their monthly amount in that category × change ("~R 96 more a month"); events affecting nothing they track are hidden.
- **My increases:** each expense can carry *Goes up every* (month) + *by* (%) — prefilled from the matching global event; shown in Expenses rows as a small chip ("↑ Jan ~9%").
- **Renewals:** name, kind (Insurance · Contract · Warranty · Subscription · Licence · Other), provider, amount + frequency, renews on, link to an expense (optional), reminder (30 days default), notes. Contract end → "Out of contract on 14 Feb — you could move to a SIM-only deal" nudge.
- **Coming up:** merged timeline of both for the next 90 days with impact amounts; Summary card "Coming up in costs" (next 2 items).

### 4.7 TFSA & retirement — "Future you" (B6) — `/future`

Segmented **TFSA · Retirement · Two-pot**.

- **TFSA:** log contributions (amount, date, provider); per tax year progress bar vs R 46,000 (content) and lifetime vs R 500,000; warnings at 80% / 100% ("R 9,000 room left this tax year — over this is taxed 40%"); "Monthly to max it by 28 Feb: R x"; link a goal.
- **Retirement:** current RA/pension/provident balances (or from net worth items), monthly contribution (you + employer), retirement age (65), expected real return (content default), desired monthly income in today's rands → projection chart, "On track for R x/month · gap R y", what +R 500/mo would change. RA deduction link to Tax centre (27.5% cap exists there).
- **Two-pot calculator:** savings-component balance, amount to withdraw (min R 2,000), admin fee → tax (marginal, using the Tax centre estimate with the withdrawal added), **net you'd get**, and **cost at retirement** (future value of the withdrawal at the expected return). Copy: "Once per tax year. Taxed at your marginal rate."

### 4.8 Challenges (B5) — `/challenges`

- **Templates:** No-spend weekend (auto: no spend entries outside budgets Sat–Sun), 52-week challenge (base R 10 or custom, normal/reverse; check in weekly), Cook at home week (auto: no Eating out spend Mon–Sun), Custom (name, days, daily check-in).
- **Card:** flame streak count, progress ring, saved so far; *Check in* for manual days; auto-checks run on open and in `notify-daily`.
- **Saved money → goal:** at the end (or weekly for 52-week) "Move R 520 into Holiday?" → goal contribution.
- Requires spend logging for auto kinds (otherwise they become manual check-in).

---

## 5. Admin portal v2

Nav becomes **Insights** (Overview, Analytics) · **People** (Users, Feedback) · **Engage** (Announcements) · **Controls** (Feature flags, Content, Audit log, Team). Phone tab bar: Overview · Users · Inbox · Announce; the rest in the menu. All new pages reuse AdminUi, StatStrip, Segmented, inset lists, ConfirmModal; every write needs a role + `aal2` and writes `admin_audit_log`.

### 5.1 Content manager `/admin/content`

Segmented **Price changes · Tax tables · Limits & rates · Seasons**. Every item has *Draft → Publish* (publish needs a reason; audited), *last published by/when*, and a **staleness warning** (fuel prices > 35 days, prime rate > 120 days, tax tables missing for the current tax year, season dates missing for next year) that also appears in Overview → Needs attention.

| Tab | What | Who edits |
|---|---|---|
| Price changes | List (upcoming / past), add/edit: title, kind, effective date, affected category, change % or c/l + unit, region, source URL, notes. *Reach*: "affects ~412 users" (count of users with expenses in that category — count only). | Support+ |
| Tax tables | Per tax year: brackets table (editable rows), rebates (primary/secondary/tertiary), thresholds, medical credits (main, first dependant, additional), RA cap. Validation (brackets ascending, no gaps). **Test calculator** comparing PAYE for R 15k / 30k / 60k / 100k gross against the bundled table. Diff view before publish. | Owner |
| Limits & rates | TFSA annual + lifetime + penalty %, two-pot minimum, transfer duty table, bond/transfer cost estimate table, fuel prices (95 inland/coastal, diesel), prime rate, Ask Loot daily cap. | Owner (tax-like), Support+ (fuel, prime) |
| Seasons | Black Friday date, festive window, back-to-school month, Survive January window, tax-season dates (auto-assessment, filing deadlines). | Support+ |

The app reads published content through `app_content()` (one call, cached by TanStack Query for 1 hour) and validates each value; failures use bundled defaults (Rule 24).

### 5.2 Announcements & push `/admin/announcements`

- **List:** Draft · Scheduled · Live · Ended, with reach and click-through.
- **Composer:** title (≤ 60), body (≤ 240), link (in-app route picker), style (Info · Good news · Heads up), **channels** (Banner on Summary · Bell notification · Push), **audience builder**: Everyone · Platform (browser / installed / iOS / Android) · Has feature flag · Onboarded / not · Inactive ≥ N days · Signed up in range · One person (search) — combinable with AND; **live reach count**. Schedule: Now / Later (date-time SAST) + optional end. **Preview**: banner light/dark, push on iPhone and Android mock-ups. *Send test to me*.
- **Send:** Support can draft and send to segments under 50 people or to one person; **Everyone / large segments = Owner**; confirmation with reason.
- **Delivery:** the `push-dispatch` job (every 5 min, from B2) is extended to materialise recipients, writes `announcement_receipts`, inserts bell notifications, sends pushes (respecting Rule 23 + the user's "News from Loot" switch).
- **App side:** `AnnouncementBanner` on Summary (dismissible, tracks seen/clicked/dismissed).
- **Stats per announcement:** recipients, seen, clicked, dismissed, pushed, push clicked.

### 5.3 Feedback & support inbox `/admin/feedback`

- **User side:** Settings → Support → **Send feedback** (also in the mobile menu, the error page "Report this", and Help). Kind Segmented: *Something's not working* · *Idea or improvement* · *Question*; message (≤ 2,000); auto-attached context: page, app version (build hash), platform, browser, theme, screen size (shown to the user before sending). **Your messages** list with status chips and replies; reply in thread.
- **Admin inbox:** counts by status (New · In progress · Waiting on user · Resolved · Closed); filters (status, kind, platform, assigned, unread); list rows: kind icon, first line, user, age, assignee.
- **Thread page:** message + context card + link to the user page; conversation; **reply** (user gets a bell notification + push `feedback_reply`); **internal notes** (admins only, never shown to the user); status, priority (Low · Normal · High), assign to an admin; *Saved replies* (Owner manages, any Support can insert).
- Roles: Viewer reads; Support+ replies, notes, changes status.

### 5.4 Deeper analytics `/admin/analytics`

Range picker (30 / 90 / 180 days / all) + Segmented tabs. All counts, never money. One RPC per tab.

| Tab | Shows |
|---|---|
| Retention | Weekly sign-up cohorts × weeks 0–12 active-rate grid (heatmap cells), week-1 and week-4 retention trend |
| Engagement | DAU / WAU / MAU lines, stickiness (DAU ÷ MAU), active days per user distribution, installed-app vs browser activity, cycle loggers (% of WAU who logged a spend this week) |
| Features | Adoption over time per feature (weekly % of active users who've used it) incl. all Phase 6 features; flag rollout state next to each |
| Notifications | Push opt-in % of active users (by platform), subscriptions, sent / clicked / CTR by kind, opt-outs by kind, announcement performance table |
| Support | Feedback volume by kind/week, open now, median first response, median time to resolve, top pages reported |

*Export CSV* of any tab's aggregates.

### 5.5 Existing pages — additions

- **Overview:** Needs attention gains *Unanswered feedback > 48h*, *Stale content*, *Push failures spiking*; headline strip gains *Push opt-in* and *Logged a spend this week*.
- **User page:** usage counts for every new table; push (subscribed devices + platforms), capture key (active, last used — never the key), payday set yes/no; actions *Send test push*, *Clear push subscriptions*, *Revoke capture key*, *Reset Ask Loot limit for today*; links to this person's feedback threads.
- **Feature flags:** seeded with every Phase 6 flag (§6).

---

## 6. Feature flags (all seeded off)

`live_cycle` (payday cycles, Safe to spend, spend log, Budgets — B1) · `push` (B2) · `apple_pay_capture` (B2) · `stokvels` · `splits` (B3) · `wishlist` · `tools` (B4) · `renewals` · `challenges` (B5) · `future_you` (B6) · `assistant` (exists) · `feedback` (B7, user side) · `announcements_banner` (B7). Family support (category) and onboarding debit orders ship unflagged.

When a flag is off, the page route redirects to Summary, nav items/cards/buttons are hidden, and server jobs skip that kind.

---

## 7. Ethan's checklist before / during the phase (B0 — no code)

1. Push **Keep me signed in** (written, not pushed).
2. Install the **Supabase CLI** and link the project (`npx supabase login`, `npx supabase link --project-ref <ref>`). Claude Code will give exact steps in B2.
3. Enable **pg_cron** and **pg_net** (Supabase → Database → Extensions) — needed in B2.
4. Generate **VAPID keys** (Claude Code does this in B2) → `VITE_VAPID_PUBLIC_KEY` in Vercel + `.env.local`; `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:) and `CRON_SECRET` as Supabase secrets.
5. **Build the Loot Shortcut once** on his iPhone (B2 gives steps), share it as an iCloud link, paste the link into Admin → Content → Limits & rates.
6. Provide **one redacted FNB and one Capitec PDF statement** (B8).
7. Set up **Google OAuth** client ID/secret + redirect URL (B8 verifies it).
8. Turn on **Gemini billing** before switching `assistant` on for everyone (D14).
9. Keep using the admin portal's flags to roll each batch out.

---

## 8. Batches

| Batch | Scope | Migration | Flags | You'll be able to… |
|---|---|---|---|---|
| **B1 — Live Loot** | `lib/cycle.ts` + `lib/sa-calendar.ts`, payday settings + onboarding (payday + debit-orders step), spend log sheet, `/spending`, Safe to spend hero, Budgets card, Before payday, monthly close step, mobile tab bar (D7), number roll + payday moment, Family support category | 026 | `live_cycle` | Set your payday, log spends, see Safe to spend move |
| **B2 — Server & push** | `injectManifest` SW, push subscribe/settings, `notify-daily` + `push-dispatch` + `_shared` modules, pg_cron jobs, `log-spend` + capture keys + Settings flow, data export/reset/deletion for new tables | 027 | `push`, `apple_pay_capture` | Get push on your phone, tap Apple Pay and see it logged |
| **B3 — People** | Stokvels (+ once-off income), Splits & IOUs (+ ShapID), Family support insight, Summary chips | 028 | `stokvels`, `splits` | Track your stokvel and who owes you |
| **B4 — Decide** | Wishlist, Tools hub, car / rent vs buy / moving out / runway / January / Black Friday, `saved_scenarios`, checker → wishlist | 029 | `wishlist`, `tools` | Cool off on purchases and run the big-decision maths |
| **B5 — Stay ahead** | `app_settings` + `price_events` (content, seeded), `app_content()` + validation + fallback, Renewals & prices page, expense increase fields, Challenges | 030 | `renewals`, `challenges` | See increases before they hit; run challenges |
| **B6 — Future you + Ask Loot** | TFSA, retirement, two-pot, tax tables read from content, Ask Loot with tools + usage cap | 031 | `future_you`, `assistant` | Track TFSA room; ask Loot questions grounded in your numbers |
| **B7 — Admin v2** | Content manager, Announcements (+ banner + delivery job), Feedback (user + admin), Analytics, Overview/User page additions, new nav | 032 | `feedback`, `announcements_banner` | Run Loot without deploys: content, comms, support, insight |
| **B8 — Trust & polish** | Real-statement parser fixes, Google OAuth e2e, production deletion check, empty-state sweep for all new pages, tutorial steps for new pages, landing page + README feature update, full regression on rig + production smoke test, flag roll-out plan | — | — | Switch everything on for everyone |

**Every batch:** `tsc -b` + build clean, all unit tests (existing 248 + new), Playwright interaction suite for the batch, SQL security suite for the migration (RLS: other users can't read/write; suspended = read-only; anon refused; admin functions require role + `aal2`), no overflow at 320/390/430, light + dark screenshots, no page errors. Then LOOT-BUILD-LOG.md, LOOT-FEATURES.md and LOOT-SCHEMA.md are updated here in the project.

---

## 9. Design notes

- New icons (Lucide): Spending `ReceiptText`, Log `Plus`, Budgets `Gauge`, Stokvels `HandCoins`, Splits `Split`, Family support `HeartHandshake`, Wishlist `Hourglass`, Tools `Calculator`, Renewals `CalendarClock`, Price changes `TrendingUp`, Challenges `Flame`, Future you `Sprout`, Feedback `MessageSquare`, Announcements `Megaphone`, Content `SlidersHorizontal`, Analytics `ChartColumn`.
- Category colour for `family_support`: giving family (same as `giving_charity`).
- Sidebar groups: **Overview** (Summary, Stats) · **Money** (Spending, Expenses, Goals, Wishlist, Statements) · **People** (Stokvels, Splits) · **Planning** (Can I afford it?, Tools, Salary planner, Compare plans, Future you, Tax centre) · **Stay ahead** (Renewals & prices, Challenges). Hidden items follow flags.
- Decision surfaces (wishlist ready, checker) use the dark `.object-card`. Tools use the planner's two-column workspace pattern. Everything else: PageHeader + StatStrip + inset grouped lists + InlineSheet.
- The Log sheet is the one new pattern: a bottom sheet on phones (spring up, drag to dismiss, keypad-first). Portal it to `<body>` (the blurred-ancestor rule).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Logging fatigue — people stop logging and Safe to spend drifts | Apple Pay capture, merchant memory, weekly pace push, and the hero still works from budgets when nothing is logged ("Log spends to make this live") |
| Payday logic bugs around weekends/holidays | `sa-calendar` + `cycle` get the heaviest unit tests (every month 2026–2028, every rule, 29–31 clamps) |
| iOS push only works in the installed app | Clear in-app explanation + link to Install Loot; bell still works |
| Supabase free plan (email limits, no SMTP, edge/cron quotas) | Push instead of email; jobs batch per run; Analytics shows failures |
| Gemini cost/data use | Daily cap, paid tier before general release (D14) |
| Content mistakes (wrong tax table) | Owner-only publish, diff + test calculator, validation, bundled fallback, audit |
| Scope (8 batches) | Flags let each batch ship independently; B8 is the only gate to "everyone" |

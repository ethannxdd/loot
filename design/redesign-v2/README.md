# Loot — Redesign v2 (Sept 2026)

Dashboard concepts explored before the v2 rebuild. Each folder has self-contained HTML
(open in any browser — fonts and icons are embedded) plus PNG renders.

| Folder | Status | Summary |
|---|---|---|
| `option-a-wallet/` | **Chosen — being implemented app-wide** | Light-first + true-black dark mode, one Loot-green accent, system font, macOS-style labelled sidebar, Apple-Card-style inline "Can I afford it?" card, calendar-tile debits, Screen-Time-style category bars. |
| `option-c-rings/` | **Saved for a future update** | Pure-black, vivid palette, rounded numerals. Hero = three concentric rings (spent % of pay / month % elapsed / goals % funded) → "spending vs calendar" pace insight; per-day "left to spend" bars; goal rings; bento tiles. |
| `option-d-widgets/` | **Saved for a future update** | iOS-widget pastel bento, rounded type throughout, floating top pill nav (iPadOS style), green gradient hero, category treemap, semicircle Loot Score gauge. |

Option B ("Editorial / Ledger", serif on cream paper) was rejected and not kept.

Ethan's intent: ship Option A now, then implement C and D "one after the other" later —
most likely as selectable themes/looks, since all three share the same data and layout
responsibilities. The shared sample data in every mockup: take-home R 32,500,
committed R 21,380, goals R 2,700, available R 8,420.

# Phase 6 — rollout plan

Every Phase 6 feature is behind a flag that's **off for everyone** after the migrations. Roll out one step at a time: turn the flag on **for yourself** (Admin → Feature flags → the flag → override for your account), use it for a few days on production, then switch it **on for everyone**. Watch Analytics before moving on.

**Roll back** any step by switching its flag off for everyone. Pages redirect to Summary, nav items and cards disappear, and the daily jobs skip that kind. Data is kept, so switching back on restores everything.

| Step | Flag(s) | Before switching on for everyone | Watch after (Admin → Analytics) |
|---|---|---|---|
| 1 | `live_cycle` | Set your payday, log a week of spends, check one month close on payday. | Features: Spend log adoption. Engagement: "Logged a spend this week". Feedback about wrong cycle dates. |
| 2 | `push` | Push on your phone (installed app) and laptop; jobs scheduled (SETUP §6); a payday/debit-order push arrived. | Notifications: opt-in %, failed vs sent (keep failures under 10%), opt-outs by kind. |
| 3 | `apple_pay_capture` | Shortcut published (SETUP §7); a week of real taps logged correctly; "To sort" works. | Features: Apple Pay capture. Spend log volume. Support: any "double logged" reports. |
| 4 | `stokvels`, `splits` | One real stokvel and a split with a payment request. | Features adoption. Support volume. |
| 5 | `wishlist`, `tools` | A wishlist item through cooling-off; each tool once; Black Friday date in Content. | Features adoption; wishlist_ready pushes. |
| 6 | `renewals`, `challenges` | Real price changes published (fuel each month, medical aid January); a no-spend weekend auto-ticked. | Notifications: renewal / price_change / challenge CTR. |
| 7 | `future_you` | TFSA and retirement checked against your own statements; tax table for the year published. | Features adoption. |
| 8 | `feedback`, `announcements_banner` | Send yourself feedback and reply; send a one-person announcement to yourself. | Support: first-reply time (aim < 24h). |
| 9 | `assistant` | **Gemini billing on (D14).** Ask your own questions for a week; check figures against the Checker. | Features: Ask Loot; Admin user pages for anyone hitting the cap. |
| 10 | `phase6_landing` | Everything above on for everyone. Then refresh the README screenshots. | Sign-ups in Overview. |

Announce each step to users with an announcement (Engage → Announcements): banner + bell, push for the big ones (payday cycles, push itself, Apple Pay).

## Content upkeep (monthly)

- **First Wednesday:** fuel prices (Content → Limits & rates) and the next fuel price change.
- **After each SARB meeting:** prime rate.
- **February (Budget):** next year's tax table (Owner), TFSA limits if they change.
- **October:** next year's Black Friday date and season windows.

Overview flags stale content automatically.

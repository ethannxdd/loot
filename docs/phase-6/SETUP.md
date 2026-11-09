# Phase 6 — what you do by hand

Everything Phase 6 needs outside the code, in order. Each feature stays **off for everyone** until you switch its flag on in Admin → Feature flags, so nothing changes for users until you do.

---

## 1. Run the migrations (Supabase → SQL Editor)

Run each file's whole contents, **in this order**, one at a time. Every file is safe to run twice.

| # | File | Adds |
|---|---|---|
| 1 | `supabase/migrations/026_live_loot.sql` | Payday settings, spend log, `live_cycle` |
| 2 | `supabase/migrations/027_push_capture.sql` | Push subscriptions, delivery log, Apple Pay capture keys, `push`, `apple_pay_capture` |
| 3 | `supabase/migrations/028_people.sql` | Stokvels, once-off income, splits, ShapID, `stokvels`, `splits` |
| 4 | `supabase/migrations/029_decide.sql` | Wishlist, saved scenarios, `wishlist`, `tools` |
| 5 | `supabase/migrations/030_stay_ahead.sql` | Content (`app_settings`, `app_content()`), price changes, renewals, challenges, `renewals`, `challenges` |
| 6 | `supabase/migrations/031_future_you.sql` | TFSA, retirement profile, Ask Loot daily cap, `future_you` |
| 7 | `supabase/migrations/032_admin_v2.sql` | Announcements, feedback inbox, content admin, analytics, `feedback`, `announcements_banner`, `phase6_landing` |

Check afterwards: `select key, enabled_globally from feature_flags order by key;` lists every Phase 6 flag, all `false`.

The SQL security suite that checks all seven migrations (other users can't read or write your rows, anon refused, suspended = read-only, admin functions need role + two-factor) runs locally with `npm run test:sql`.

---

## 2. Install the Supabase CLI (Windows) — once

The new edge functions share code in `supabase/functions/_shared/`, which the dashboard editor can't deploy.

```bash
npm i -D supabase
```

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` is the bit before `.supabase.co` in your project URL (Settings → General → Reference ID).

---

## 3. Extensions (Supabase → Database → Extensions)

Turn on **pg_cron** and **pg_net**. (`pgcrypto` and Vault are already on.)

---

## 4. Secrets

Generate push keys once:

```bash
npm run vapid
```

It prints `VITE_VAPID_PUBLIC_KEY=…` and `VAPID_PRIVATE_JWK=…`. Then make a long random cron secret (any password generator, 40+ characters) and set the edge secrets:

```bash
npx supabase secrets set VAPID_PRIVATE_JWK='<the JSON from npm run vapid>' VAPID_SUBJECT=mailto:<your email> CRON_SECRET=<long random value>
```

`GEMINI_API_KEY` is already set from Phase 4 (Ask Loot). Turn on **Gemini billing** before switching `assistant` on for everyone (D14).

**Vercel** → Project → Settings → Environment Variables → add `VITE_VAPID_PUBLIC_KEY` (Production and Preview), then redeploy. Add the same line to your `.env.local`.

---

## 5. Deploy the edge functions

```bash
npx supabase functions deploy notify-daily --no-verify-jwt
```

```bash
npx supabase functions deploy push-dispatch --no-verify-jwt
```

```bash
npx supabase functions deploy log-spend --no-verify-jwt
```

```bash
npx supabase functions deploy loot-assistant
```

(`loot-assistant` keeps Verify JWT **on**. `admin-actions` and `delete-account` are unchanged.)

---

## 6. Schedule the jobs (SQL Editor)

Open `supabase/sql/027_cron_setup.sql`, replace the two placeholders (your project URL and the same `CRON_SECRET`), and run it. Check: `select jobname, schedule, active from cron.job;` shows three Loot jobs.

Test once by hand (SQL Editor): `select public.call_edge('notify-daily', '{"run":"daily"}');` then `select * from net._http_response order by created desc limit 1;` should show status 200.

---

## 7. Apple Pay Shortcut

Follow `docs/phase-6/SHORTCUT.md` on your iPhone, then publish the iCloud link in Admin → Content → Limits & rates → Apple Pay Shortcut link.

---

## 8. Content to publish before the matching flags go on

Admin → Content shows what's stale. The migration seeds verified values (prime 10.75%, November fuel prices, the SARS transfer duty and 2026/27 tax tables, TFSA R46,000). Two **draft** price changes are placeholders: set the real December fuel change and the 2027 medical aid increase, then publish them.

---

## 9. Google sign-in check (B8)

Supabase → Authentication → Providers → Google: enabled, client ID and secret filled in. Authentication → URL Configuration: Site URL is your production URL; Redirect URLs include `https://<your-domain>/**` and `http://localhost:5173/**`.

Google Cloud Console → APIs & Services → Credentials → your OAuth client: Authorised JavaScript origins include your production URL; Authorised redirect URIs include `https://<project-ref>.supabase.co/auth/v1/callback`.

Then test: (1) laptop browser → Continue with Google → lands on Summary; (2) iPhone Safari → same; (3) installed app on iPhone → Continue with Google opens Safari, signs in, and returns to the app (if it stays in Safari, sign in with email inside the app — known iOS PWA limit).

---

## 10. Production account-deletion check (B8)

1. Sign up with a throwaway email, finish onboarding, and add one of everything: an expense, a goal, a spend, a stokvel, a split, a wishlist item, a saved scenario, a renewal, a challenge, a TFSA entry, a feedback message, and turn push on.
2. Copy the account's id from Admin → Users.
3. In the app: Settings → Delete account → type DELETE.
4. Run this in the SQL Editor with the id — every count must be 0:

```sql
with t(name, n) as (
  select 'auth.users', count(*) from auth.users where id = '<user-id>' union all
  select 'profiles', count(*) from profiles where id = '<user-id>' union all
  select 'expenses', count(*) from expenses where user_id = '<user-id>' union all
  select 'savings_goals', count(*) from savings_goals where user_id = '<user-id>' union all
  select 'goal_contributions', count(*) from goal_contributions where user_id = '<user-id>' union all
  select 'monthly_snapshots', count(*) from monthly_snapshots where user_id = '<user-id>' union all
  select 'notifications', count(*) from notifications where user_id = '<user-id>' union all
  select 'spend_entries', count(*) from spend_entries where user_id = '<user-id>' union all
  select 'spend_merchant_rules', count(*) from spend_merchant_rules where user_id = '<user-id>' union all
  select 'push_subscriptions', count(*) from push_subscriptions where user_id = '<user-id>' union all
  select 'push_deliveries', count(*) from push_deliveries where user_id = '<user-id>' union all
  select 'capture_keys', count(*) from capture_keys where user_id = '<user-id>' union all
  select 'stokvels', count(*) from stokvels where user_id = '<user-id>' union all
  select 'stokvel_members', count(*) from stokvel_members where user_id = '<user-id>' union all
  select 'stokvel_payments', count(*) from stokvel_payments where user_id = '<user-id>' union all
  select 'once_off_income', count(*) from once_off_income where user_id = '<user-id>' union all
  select 'splits', count(*) from splits where user_id = '<user-id>' union all
  select 'split_shares', count(*) from split_shares where user_id = '<user-id>' union all
  select 'wishlist_items', count(*) from wishlist_items where user_id = '<user-id>' union all
  select 'saved_scenarios', count(*) from saved_scenarios where user_id = '<user-id>' union all
  select 'renewals', count(*) from renewals where user_id = '<user-id>' union all
  select 'challenges', count(*) from challenges where user_id = '<user-id>' union all
  select 'challenge_checkins', count(*) from challenge_checkins where user_id = '<user-id>' union all
  select 'tfsa_contributions', count(*) from tfsa_contributions where user_id = '<user-id>' union all
  select 'retirement_profile', count(*) from retirement_profile where user_id = '<user-id>' union all
  select 'assistant_usage', count(*) from assistant_usage where user_id = '<user-id>' union all
  select 'announcement_receipts', count(*) from announcement_receipts where user_id = '<user-id>' union all
  select 'feedback', count(*) from feedback where user_id = '<user-id>' union all
  select 'app_activity', count(*) from app_activity where user_id = '<user-id>' union all
  select 'user_feature_overrides', count(*) from user_feature_overrides where user_id = '<user-id>'
)
select * from t where n > 0;
```

No rows = everything is gone. (`admin_audit_log` deliberately keeps entries with the email, by design from Migration 025.)

---

## 11. Statement parsers (B8 — waiting on you)

Put one redacted FNB PDF and one redacted Capitec PDF in `test-fixtures/statements/` (git-ignored) and ask Claude Code to fix the parsers against them and turn them into synthetic regression fixtures. Not done yet — there were no statements to test with.

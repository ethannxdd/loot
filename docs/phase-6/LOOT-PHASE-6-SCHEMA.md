# Loot — Phase 6 schema drafts (Migrations 026–032)

> **Status: DRAFT, not run.** Companion to `claude/LOOT-PHASE-6.md`. Each migration is built (and may be refined) by Claude Code in its batch; the repo file `supabase/migrations/0NN_*.sql` becomes the source of truth, and the final version is merged into LOOT-SCHEMA.md at that batch's sign-off (same as Migration 025).
> Every migration must be **safe to run twice** (`if not exists`, `drop policy if exists`, `on conflict do nothing`).

## Rules every new table follows

1. `user_id uuid not null references auth.users on delete cascade` on every user-data table (child tables cascade from their parent), so `delete-account` keeps working with no code change.
2. RLS on. Own-row policy `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` unless stated.
3. **Suspension:** the three restrictive `Suspended: no inserts/updates/deletes` policies from Migration 025 are added to every new user-data table with the helper below. Exception: feedback (users can still contact support while suspended — writes go through a security-definer RPC).
4. `updated_at` trigger where the table has `updated_at` (reuse the existing `set_updated_at()` if present in the repo; otherwise create it once in 026).
5. Every new user table is added to: **Settings → Your data** JSON export, **Danger zone → Reset all data**, `admin_user_detail` usage counts (032), and the SQL security suite.

```sql
-- Helper used at the end of each migration (026 defines it; later migrations call it)
create or replace function public.add_suspension_policies(tables text[])
returns void language plpgsql as $$
declare t text;
begin
  foreach t in array tables loop
    execute format('drop policy if exists "Suspended: no inserts" on public.%I', t);
    execute format('drop policy if exists "Suspended: no updates" on public.%I', t);
    execute format('drop policy if exists "Suspended: no deletes" on public.%I', t);
    execute format('create policy "Suspended: no inserts" on public.%I as restrictive for insert to authenticated with check (not (select public.is_suspended()))', t);
    execute format('create policy "Suspended: no updates" on public.%I as restrictive for update to authenticated using (not (select public.is_suspended()))', t);
    execute format('create policy "Suspended: no deletes" on public.%I as restrictive for delete to authenticated using (not (select public.is_suspended()))', t);
  end loop;
end $$;
revoke all on function public.add_suspension_policies(text[]) from public, anon, authenticated;
```

---

## Migration 026 — Live Loot (B1)

```sql
alter table public.profiles
  add column if not exists payday_day int check (payday_day between 1 and 31),            -- null = calendar month
  add column if not exists payday_rule text not null default 'previous_working_day'
    check (payday_rule in ('previous_working_day', 'next_working_day', 'exact', 'last_working_day')),
  add column if not exists payday_prompt_dismissed_at timestamptz,
  add column if not exists last_payday_seen text;                                         -- cycle key; drives the payday moment once

create table if not exists public.spend_entries (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  amount        numeric     not null check (amount <> 0),   -- negative = money back (split settled, stokvel payout added)
  merchant      text,
  note          text,
  category      text,                                       -- null = "To sort"
  spent_at      timestamptz not null default now(),         -- cycle is derived from this + payday settings, never stored
  source        text        not null default 'manual' check (source in ('manual', 'apple_pay', 'split', 'stokvel')),
  source_id     uuid,                                       -- split_shares.id / once_off_income.id
  external_hash text,                                       -- dedupe for auto-capture
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists spend_entries_user_time on public.spend_entries (user_id, spent_at desc) where deleted_at is null;
create unique index if not exists spend_entries_dedupe on public.spend_entries (user_id, external_hash) where external_hash is not null;

create table if not exists public.spend_merchant_rules (
  user_id      uuid not null references auth.users on delete cascade,
  merchant_key text not null,                               -- lower(trim(merchant)) with digits/punctuation stripped
  category     text not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, merchant_key)
);

alter table public.spend_entries        enable row level security;
alter table public.spend_merchant_rules enable row level security;
drop policy if exists "Users manage their spend entries" on public.spend_entries;
create policy "Users manage their spend entries" on public.spend_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their merchant rules" on public.spend_merchant_rules;
create policy "Users manage their merchant rules" on public.spend_merchant_rules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

select public.add_suspension_policies(array['spend_entries', 'spend_merchant_rules']);

insert into public.feature_flags (key, description) values
  ('live_cycle', 'Payday cycles, Safe to spend, spend log and Budgets')
on conflict (key) do nothing;
```

`family_support` category: no SQL (categories are text). Add to the quick reference list in LOOT-SCHEMA.md (26 categories).

---

## Migration 027 — Push & capture (B2)

Needs extensions **pg_cron**, **pg_net**, **pgcrypto** (on by default in Supabase, schema `extensions`) and Vault.

```sql
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}';   -- {"payday": true, "debit_orders": true, ...}; missing key = on
alter table public.notifications
  add column if not exists pushed_at timestamptz;

create table if not exists public.push_subscriptions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  endpoint        text        not null unique,
  p256dh          text        not null,
  auth            text        not null,
  platform        text        not null check (platform in ('browser', 'pwa', 'ios', 'android')),
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   int         not null default 0
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage their push subscriptions" on public.push_subscriptions;
create policy "Users manage their push subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- NOT suspension-restricted: a suspended person must still be able to turn push off.

create table if not exists public.push_deliveries (            -- analytics + click tracking; no client access
  id              bigint      generated always as identity primary key,
  user_id         uuid        not null references auth.users on delete cascade,
  notification_id uuid        references public.notifications on delete set null,
  announcement_id uuid,                                         -- FK added in 032
  kind            text        not null,
  status          text        not null check (status in ('sent', 'failed', 'expired')),
  sent_at         timestamptz not null default now(),
  clicked_at      timestamptz
);
alter table public.push_deliveries enable row level security;   -- no policies
revoke all on public.push_deliveries from anon, authenticated;

create table if not exists public.capture_keys (               -- one active Apple Pay capture key per user
  user_id      uuid        primary key references auth.users on delete cascade,
  key_hash     text        not null unique,                     -- sha256 hex; the key itself is never stored
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  uses_day     date,
  uses_today   int         not null default 0,
  total_uses   int         not null default 0
);
alter table public.capture_keys enable row level security;      -- no policies: only RPCs + service role
revoke all on public.capture_keys from anon, authenticated;

create or replace function public.create_capture_key()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare k text := 'loot_cap_' || encode(gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.is_suspended() then raise exception 'account suspended'; end if;
  insert into public.capture_keys (user_id, key_hash) values (auth.uid(), encode(digest(k, 'sha256'), 'hex'))
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now(),
    last_used_at = null, uses_day = null, uses_today = 0, total_uses = 0;
  return k;                                                     -- shown once
end $$;

create or replace function public.revoke_capture_key()
returns void language sql security definer set search_path = public as $$
  delete from public.capture_keys where user_id = auth.uid();
$$;

create or replace function public.my_capture_key_status()
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce((select jsonb_build_object('active', true, 'created_at', created_at,
    'last_used_at', last_used_at, 'total_uses', total_uses)
    from public.capture_keys where user_id = auth.uid()), jsonb_build_object('active', false));
$$;

create or replace function public.mark_push_clicked(delivery_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.push_deliveries set clicked_at = coalesce(clicked_at, now())
  where id = delivery_id and user_id = auth.uid();
$$;

revoke all on function public.create_capture_key(), public.revoke_capture_key(),
  public.my_capture_key_status(), public.mark_push_clicked(bigint) from public, anon;
grant execute on function public.create_capture_key(), public.revoke_capture_key(),
  public.my_capture_key_status(), public.mark_push_clicked(bigint) to authenticated;

insert into public.feature_flags (key, description) values
  ('push', 'Push notifications (settings + server sends)'),
  ('apple_pay_capture', 'Log Apple Pay spends automatically via iOS Shortcuts')
on conflict (key) do nothing;
```

**Scheduled jobs** (run once in the SQL Editor after deploying the functions; replace the placeholders):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'loot_project_url');
select vault.create_secret('<long random CRON_SECRET, same as the edge secret>', 'loot_cron_secret');

create or replace function public.call_edge(fn text, body jsonb default '{}')
returns void language sql security definer set search_path = public, extensions, vault as $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'loot_project_url') || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json',
               'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'loot_cron_secret')),
    body    := body);
$$;
revoke all on function public.call_edge(text, jsonb) from public, anon, authenticated;

select cron.schedule('loot-notify-daily',  '0 5 * * *',  $$ select public.call_edge('notify-daily', '{"run":"daily"}') $$);   -- 07:00 SAST
select cron.schedule('loot-notify-weekly', '0 16 * * 0', $$ select public.call_edge('notify-daily', '{"run":"weekly"}') $$);  -- Sun 18:00 SAST
select cron.schedule('loot-push-dispatch', '*/5 * * * *', $$ select public.call_edge('push-dispatch') $$);                    -- instant + queued pushes
```

Edge functions (deploy with the CLI, **Verify JWT off** — they authenticate themselves):
- `notify-daily` — requires `x-cron-secret`; service role; generates the scheduled kinds and inserts `notifications`; batches users (500 per page). It does not send — the dispatcher does.
- `push-dispatch` — requires `x-cron-secret`; sends push for `notifications` rows with `pushed_at is null` created in the last 24h whose kind is push-enabled for that user, outside quiet hours (21:00–07:00 SAST rows wait), max 3 automatic pushes/user/day (Rule 23). B7 extends it to deliver announcements.
- `log-spend` — requires `Authorization: Bearer loot_cap_…`; looks up `sha256(key)`; 200/day limit via `uses_today`.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

---

## Migration 028 — People (B3)

```sql
alter table public.profiles add column if not exists payshap_id text;   -- the user's own ShapID, optional

create table if not exists public.stokvels (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users on delete cascade,
  name                  text        not null,
  type                  text        not null check (type in ('rotating', 'savings', 'grocery', 'burial', 'investment')),
  contribution_amount   numeric     not null check (contribution_amount > 0),
  frequency             text        not null default 'monthly' check (frequency in ('monthly', 'weekly', 'fortnightly')),
  contribution_day      int         check (contribution_day between 1 and 31),
  start_month           date        not null,                -- first of month
  member_count          int         not null check (member_count between 2 and 200),
  my_position           int,                                 -- rotating only
  payout_date           date,                                -- savings / grocery / investment
  expected_interest_pct numeric,
  expense_id            uuid        references public.expenses on delete set null,   -- the linked monthly commitment
  ended_at              timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.stokvel_members (
  id          uuid primary key default gen_random_uuid(),
  stokvel_id  uuid not null references public.stokvels on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,                                 -- names only (POPIA); no phone numbers
  position    int,
  is_me       boolean not null default false,
  paid_out_on date
);

create table if not exists public.stokvel_payments (
  id         uuid        primary key default gen_random_uuid(),
  stokvel_id uuid        not null references public.stokvels on delete cascade,
  user_id    uuid        not null references auth.users on delete cascade,
  month      date        not null,
  kind       text        not null check (kind in ('contribution', 'payout')),
  amount     numeric     not null,
  paid_on    date        not null default current_date,
  created_at timestamptz not null default now(),
  unique (stokvel_id, month, kind)
);

create table if not exists public.once_off_income (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  label       text        not null,
  amount      numeric     not null check (amount > 0),
  expected_on date        not null,
  kind        text        not null default 'other' check (kind in ('stokvel', 'bonus', 'refund', 'other')),
  source_id   uuid,                                          -- stokvels.id
  received_on date,
  handled_as  text        check (handled_as in ('cycle', 'goal')),
  goal_id     uuid        references public.savings_goals on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.splits (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  title          text        not null,
  total          numeric     not null check (total > 0),
  spent_on       date        not null default current_date,
  paid_by        text        not null check (paid_by in ('me', 'other')),
  payer_name     text,                                       -- when paid_by = 'other'
  split_mode     text        not null default 'equal' check (split_mode in ('equal', 'amounts', 'shares')),
  spend_entry_id uuid        references public.spend_entries on delete set null,
  note           text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.split_shares (
  id               uuid        primary key default gen_random_uuid(),
  split_id         uuid        not null references public.splits on delete cascade,
  user_id          uuid        not null references auth.users on delete cascade,
  person_name      text        not null,
  is_me            boolean     not null default false,
  amount           numeric     not null check (amount >= 0),
  settled_amount   numeric     not null default 0,
  settled_at       timestamptz,
  last_reminded_at timestamptz,
  reminders_sent   int         not null default 0
);

create index if not exists split_shares_open on public.split_shares (user_id) where settled_at is null;

do $$ declare t text; begin
  foreach t in array array['stokvels','stokvel_members','stokvel_payments','once_off_income','splits','split_shares'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('create policy "Users manage their own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

select public.add_suspension_policies(array['stokvels','stokvel_members','stokvel_payments','once_off_income','splits','split_shares']);

insert into public.feature_flags (key, description) values
  ('stokvels', 'Stokvel tracking'), ('splits', 'Splits & IOUs')
on conflict (key) do nothing;
```

> Child-table inserts must also check the parent belongs to the user (e.g. `stokvel_members.stokvel_id` → `stokvels.user_id = auth.uid()`). Add `with check (... and exists (select 1 from public.stokvels s where s.id = stokvel_id and s.user_id = auth.uid()))` on `stokvel_members`, `stokvel_payments` and `split_shares`.

---

## Migration 029 — Decide (B4)

```sql
create table if not exists public.wishlist_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users on delete cascade,
  name              text        not null,
  price             numeric     not null check (price > 0),
  url               text,
  category          text,
  cool_off_days     int         not null check (cool_off_days in (2, 7, 30)),
  added_at          timestamptz not null default now(),
  ready_at          timestamptz not null,                    -- added_at + cool_off_days (set by the app)
  status            text        not null default 'waiting' check (status in ('waiting', 'ready', 'bought', 'dropped', 'snoozed')),
  snoozed_until     timestamptz,
  decided_at        timestamptz,
  verdict           text,                                    -- verdict at ready time (Rule 22)
  verdict_reasoning text,
  tags              text[]      not null default '{}',       -- e.g. {'black_friday'}
  target_price      numeric,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists wishlist_ready on public.wishlist_items (user_id, status, ready_at);

create table if not exists public.saved_scenarios (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  tool       text        not null check (tool in ('car', 'rent_vs_buy', 'moving_out', 'runway', 'january', 'black_friday', 'two_pot', 'retirement')),
  name       text        not null,
  inputs     jsonb       not null default '{}',              -- tool inputs only; outputs are recomputed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['wishlist_items','saved_scenarios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('create policy "Users manage their own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
select public.add_suspension_policies(array['wishlist_items','saved_scenarios']);

insert into public.feature_flags (key, description) values
  ('wishlist', 'Wishlist with cooling-off'), ('tools', 'Tools hub: calculators and seasonal planners')
on conflict (key) do nothing;
```

---

## Migration 030 — Stay ahead + content (B5)

```sql
-- Global content (admin-managed from B7; seeded here)
create table if not exists public.app_settings (
  key          text        primary key check (key ~ '^[a-z][a-z0-9_:/.-]{1,60}$'),
  value        jsonb,                                         -- published value (null = not published → bundled default)
  draft        jsonb,
  published_at timestamptz,
  published_by uuid references auth.users on delete set null,
  updated_by   uuid references auth.users on delete set null,
  updated_at   timestamptz not null default now()
);
alter table public.app_settings enable row level security;      -- no client policies; read via app_content()
revoke all on public.app_settings from anon, authenticated;

create table if not exists public.price_events (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null check (kind in ('fuel', 'electricity', 'water', 'municipal', 'medical_aid', 'insurance', 'cellphone', 'other')),
  title         text        not null,
  description   text        not null default '',
  effective_on  date        not null,
  category      text        not null,                         -- one of the 26 expense categories
  change_pct    numeric,
  change_amount numeric,
  change_unit   text        check (change_unit in ('c/l', 'R')),
  region        text        not null default 'all' check (region in ('all', 'inland', 'coastal')),
  source_url    text,
  status        text        not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by    uuid        references auth.users on delete set null,
  updated_by    uuid        references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (change_pct is not null or change_amount is not null)
);
alter table public.price_events enable row level security;
drop policy if exists "Signed-in users read published price events" on public.price_events;
create policy "Signed-in users read published price events" on public.price_events
  for select to authenticated using (status = 'published');

create or replace function public.app_content()
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_settings where value is not null;
$$;
revoke all on function public.app_content() from public, anon;
grant execute on function public.app_content() to authenticated;

-- Seeds (values verified 2026-10-22; Claude Code verifies the rest against official sources at build time and cites them in the build log)
insert into public.app_settings (key, value, published_at) values
  ('tfsa_limits', '{"annual": 46000, "lifetime": 500000, "penalty_pct": 40, "from_tax_year": "2026/27"}', now()),
  ('two_pot',     '{"min_withdrawal": 2000, "per_tax_year": 1}', now()),
  ('assistant_daily_cap', '30', now()),
  ('seasons',     '{"black_friday": "2026-11-27", "january_window": {"start": "11-01", "end": "01-15"}, "black_friday_window_days_after": 3}', now())
on conflict (key) do nothing;
-- To seed at build time (verify first, never guess): 'prime_rate' (SARB), 'fuel_prices' (DMRE/DMPR, inland + coastal 95 + diesel),
-- 'transfer_duty' (SARS current table), 'bond_costs' (estimate table, label as estimate), 'tax_tables:2026/27' (from lib/tax/tax-tables.ts),
-- plus upcoming 'price_events' (next fuel adjustment, medical aid Jan 2027) as status 'draft' for Ethan to publish.

-- Users' own expected increases
alter table public.expenses
  add column if not exists increase_month int check (increase_month between 1 and 12),
  add column if not exists increase_pct   numeric;

create table if not exists public.renewals (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  name          text        not null,
  kind          text        not null check (kind in ('insurance', 'contract', 'warranty', 'subscription', 'licence', 'other')),
  provider      text,
  amount        numeric,
  frequency     text        not null default 'monthly' check (frequency in ('monthly', 'annual', 'once-off')),
  renews_on     date        not null,
  expense_id    uuid        references public.expenses on delete set null,
  reminder_days int         not null default 30 check (reminder_days between 0 and 120),
  notes         text,
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.challenges (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  kind       text        not null check (kind in ('no_spend_weekend', '52_week', 'cook_at_home', 'custom')),
  title      text        not null,
  starts_on  date        not null,
  ends_on    date        not null,
  settings   jsonb       not null default '{}',             -- 52_week: {"base": 10, "reverse": false}
  goal_id    uuid        references public.savings_goals on delete set null,
  status     text        not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.challenge_checkins (
  id           uuid    primary key default gen_random_uuid(),
  challenge_id uuid    not null references public.challenges on delete cascade,
  user_id      uuid    not null references auth.users on delete cascade,
  day          date    not null,
  success      boolean not null,
  amount_saved numeric not null default 0,
  auto         boolean not null default false,
  unique (challenge_id, day)
);

do $$ declare t text; begin
  foreach t in array array['renewals','challenges','challenge_checkins'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('create policy "Users manage their own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
select public.add_suspension_policies(array['renewals','challenges','challenge_checkins']);

insert into public.feature_flags (key, description) values
  ('renewals', 'Renewals & price changes'), ('challenges', 'Savings challenges')
on conflict (key) do nothing;
```

---

## Migration 031 — Future you + Ask Loot (B6)

```sql
create table if not exists public.tfsa_contributions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  tax_year       text        not null,                       -- '2026/27'
  amount         numeric     not null check (amount > 0),
  contributed_on date        not null,
  provider       text,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.retirement_profile (
  user_id               uuid        primary key references auth.users on delete cascade,
  retirement_age        int         not null default 65 check (retirement_age between 40 and 80),
  ra_balance            numeric     not null default 0,
  pension_balance       numeric     not null default 0,
  monthly_contribution  numeric     not null default 0,
  employer_contribution numeric     not null default 0,
  real_return_pct       numeric,                             -- null = content default
  desired_income        numeric,                             -- per month, today's rands
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['tfsa_contributions','retirement_profile'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('create policy "Users manage their own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
select public.add_suspension_policies(array['tfsa_contributions','retirement_profile']);

create table if not exists public.assistant_usage (
  user_id   uuid not null references auth.users on delete cascade,
  day       date not null,                                   -- Africa/Johannesburg date
  questions int  not null default 0,
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;  -- no policies; RPC only
revoke all on public.assistant_usage from anon, authenticated;

-- Called by the loot-assistant edge function with the user's token before each question
create or replace function public.use_assistant_question()
returns int language plpgsql security definer set search_path = public as $$
declare cap int := coalesce((select (value #>> '{}')::int from public.app_settings where key = 'assistant_daily_cap'), 30);
        today date := (now() at time zone 'Africa/Johannesburg')::date; used int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.assistant_usage (user_id, day, questions) values (auth.uid(), today, 1)
  on conflict (user_id, day) do update set questions = public.assistant_usage.questions + 1
  returning questions into used;
  if used > cap then raise exception 'daily limit reached'; end if;
  return cap - used;                                          -- questions left today
end $$;
revoke all on function public.use_assistant_question() from public, anon;
grant execute on function public.use_assistant_question() to authenticated;

insert into public.feature_flags (key, description) values
  ('future_you', 'TFSA, retirement and two-pot')
on conflict (key) do nothing;
```

---

## Migration 032 — Admin portal v2 (B7)

```sql
create table if not exists public.announcements (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null check (char_length(title) <= 60),
  body            text        not null check (char_length(body) <= 240),
  link            text,                                       -- in-app route only (starts with '/')
  style           text        not null default 'info' check (style in ('info', 'good', 'heads_up')),
  channels        text[]      not null default '{banner}',    -- banner | bell | push
  audience        jsonb       not null default '{"all": true}',
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text        not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  recipient_count int,
  created_by      uuid        references auth.users on delete set null,
  sent_by         uuid        references auth.users on delete set null,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.announcement_receipts (
  announcement_id uuid not null references public.announcements on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  delivered_at    timestamptz not null default now(),
  seen_at         timestamptz,
  clicked_at      timestamptz,
  dismissed_at    timestamptz,
  pushed_at       timestamptz,
  push_clicked_at timestamptz,
  primary key (announcement_id, user_id)
);
alter table public.push_deliveries
  drop constraint if exists push_deliveries_announcement_fk,
  add constraint push_deliveries_announcement_fk foreign key (announcement_id) references public.announcements on delete set null;

create table if not exists public.feedback (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users on delete cascade,
  kind                 text        not null check (kind in ('problem', 'idea', 'question')),
  message              text        not null check (char_length(message) between 1 and 2000),
  context              jsonb       not null default '{}',     -- route, app_version, platform, browser, theme, viewport
  status               text        not null default 'new' check (status in ('new', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  priority             text        not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to          uuid        references auth.users on delete set null,
  unread_by_user       boolean     not null default false,
  first_response_at    timestamptz,
  resolved_at          timestamptz,
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now()
);
create table if not exists public.feedback_messages (
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null references public.feedback on delete cascade,
  sender      text        not null check (sender in ('user', 'admin')),
  admin_id    uuid        references auth.users on delete set null,
  body        text        not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create table if not exists public.feedback_notes (               -- internal, admins only
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null references public.feedback on delete cascade,
  admin_id    uuid        references auth.users on delete set null,
  body        text        not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.saved_replies (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  body       text        not null,
  created_by uuid        references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

-- All five: RLS on, no client policies (RPC only)
do $$ declare t text; begin
  foreach t in array array['announcements','announcement_receipts','feedback','feedback_messages','feedback_notes','saved_replies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

insert into public.feature_flags (key, description) values
  ('feedback', 'In-app feedback & support messages'), ('announcements_banner', 'Announcement banner on Summary')
on conflict (key) do nothing;
```

### Functions (all `security definer`, `set search_path = public`; `admin_*` start with `admin_require(min_role)` and log via `admin_log`)

| Function | Caller | Purpose |
|---|---|---|
| `my_announcements()` | authenticated | Live banner announcements for me, not dismissed |
| `mark_announcement(id, action)` | authenticated | seen / clicked / dismissed / push_clicked |
| `send_feedback(kind, message, context)` | authenticated (**works while suspended**) | Creates thread + first message; 10 per day limit |
| `my_feedback()` / `my_feedback_thread(id)` / `reply_feedback(id, body)` | authenticated | User side; reading a thread clears `unread_by_user` |
| `admin_list_feedback(status, kind, platform, assigned, search, limit, offset)` | Viewer+ | Inbox |
| `admin_feedback_detail(id)` | Viewer+ | Thread, notes, context, user summary |
| `admin_reply_feedback(id, body)` | Support+ | Adds message, sets `first_response_at`, `unread_by_user`, inserts a `feedback_reply` notification (`push-dispatch` sends it within 5 minutes) |
| `admin_add_feedback_note(id, body)` / `admin_update_feedback(id, status, priority, assigned_to)` | Support+ | |
| `admin_list_saved_replies()` / `admin_save_reply(...)` / `admin_delete_reply(id)` | Viewer+ / Owner / Owner | |
| `admin_list_content()` | Viewer+ | Settings (draft + published + staleness) and price events |
| `admin_save_setting_draft(key, draft)` | Support+ (Owner for `tax_tables:*`, `tfsa_limits`, `two_pot`, `transfer_duty`, `bond_costs`, `assistant_daily_cap`) | |
| `admin_publish_setting(key, reason)` | same split | Copies draft → value |
| `admin_upsert_price_event(...)` / `admin_set_price_event_status(id, status, reason)` | Support+ | |
| `admin_price_event_reach(category)` | Viewer+ | Count of users with an active expense in that category |
| `admin_save_announcement(...)` / `admin_announcement_reach(audience)` | Support+ | Reach = count only |
| `admin_send_announcement(id, reason)` | Support+ (≤ 50 recipients or one person) / Owner (everyone or ≥ 50) | Sets status scheduled/live; the job delivers |
| `admin_cancel_announcement(id, reason)` / `admin_announcement_stats(id)` | Support+ / Viewer+ | |
| `admin_analytics_retention(days)` / `_engagement(days)` / `_features(days)` / `_notifications(days)` / `_support(days)` | Viewer+ | Aggregates only |
| `admin_overview_stats(days)` | Viewer+ | **Replaced:** adds push opt-in, weekly loggers, unanswered feedback > 48h, stale content, push failure rate |
| `admin_user_detail(user)` | Viewer+ | **Replaced:** adds counts for every Phase 6 table, push devices + platforms, capture key active/last used, payday set, feedback thread ids |
| `admin_clear_push(user, reason)` / `admin_revoke_capture_key(user, reason)` / `admin_reset_assistant_limit(user, reason)` | Support+ | |
| `admin_send_test_push(user)` | Support+ | Via edge function `admin-actions` (new action `test_push`) |

Announcement delivery: **extend `push-dispatch`** (no new cron job) — each run, announcements with status `scheduled` and `starts_at <= now()` are materialised (recipients from the audience, `announcement_receipts` rows, bell `notifications` rows if the bell channel is on), status → `live`; pushes go out through the same quiet-hours and daily-cap rules; `ends_at` passed → `ended`.

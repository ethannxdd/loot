-- =============================================================================================================
-- Migration 030 — Stay ahead + content (Phase 6, batch B5)
-- Content-managed values (app_settings, read by everyone through app_content()), global price events, the user's
-- own expected increases on expenses, renewals, challenges, and the `renewals` / `challenges` flags.
-- Safe to run twice (seeds use on conflict do nothing — a value an admin already published is never overwritten).
--
-- Seeded values, checked 2026-11-09 (sources also in src/lib/content-defaults.ts):
--   prime_rate 10.75% from 25 Sep 2026 — SARB MPC 23 Sep 2026 (repo 7.25%) — moneyweb.co.za/news/economy/sarb-ups-repo-rate-to-7-25/
--   fuel_prices from 4 Nov 2026 — 95 ULP R30.24 inland / R29.37 coastal; diesel 500ppm R30.85 / R29.98 (DMPR)
--   transfer_duty — SARS table effective 1 Apr 2025, unchanged for 2026/27 — sars.gov.za/tax-rates/transfer-duty/
--   tfsa_limits R46,000 / R500,000 / 40% — Budget 2026, effective 1 Mar 2026
--   two_pot minimum R2,000, once per tax year
--   tax_tables:2026/27 — identical to the bundled table in src/lib/tax/tax-tables.ts
--   bond_costs — an ESTIMATE (attorney + deeds office), labelled as such in the app
-- Price events are seeded as DRAFTS with placeholder changes; set the real figures in Admin → Content before publishing.
--
-- Deviations from the draft:
--   * app_content() only returns published values (value is not null) — drafts stay private to admins.
--   * renewals.amount must be ≥ 0; challenge settings limited to 4 kB; updated_at triggers.
--   * shortcut_url and retirement_real_return_pct are also content keys (B2 / B6).
-- =============================================================================================================

create table if not exists public.app_settings (
  key          text        primary key check (key ~ '^[a-z][a-z0-9_:/.-]{1,60}$'),
  value        jsonb,
  draft        jsonb,
  published_at timestamptz,
  published_by uuid references auth.users on delete set null,
  updated_by   uuid references auth.users on delete set null,
  updated_at   timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create table if not exists public.price_events (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null check (kind in ('fuel', 'electricity', 'water', 'municipal', 'medical_aid', 'insurance', 'cellphone', 'other')),
  title         text        not null check (char_length(title) between 1 and 100),
  description   text        not null default '' check (char_length(description) <= 1000),
  effective_on  date        not null,
  category      text        not null,
  change_pct    numeric     check (change_pct between -100 and 1000),
  change_amount numeric,
  change_unit   text        check (change_unit in ('c/l', 'R')),
  region        text        not null default 'all' check (region in ('all', 'inland', 'coastal')),
  source_url    text        check (source_url is null or source_url ~ '^https://'),
  status        text        not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by    uuid        references auth.users on delete set null,
  updated_by    uuid        references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (change_pct is not null or change_amount is not null)
);
create index if not exists price_events_published on public.price_events (effective_on) where status = 'published';
alter table public.price_events enable row level security;
revoke all on public.price_events from anon;
grant select on public.price_events to authenticated;
drop policy if exists "Signed-in users read published price events" on public.price_events;
create policy "Signed-in users read published price events" on public.price_events
  for select to authenticated using (status = 'published');

create or replace function public.app_content()
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_settings where value is not null;
$$;
revoke all on function public.app_content() from public, anon;
grant execute on function public.app_content() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Seeds (published) — verified values only
-- ---------------------------------------------------------------------------------------------------------
insert into public.app_settings (key, value, published_at) values
  ('prime_rate', '{"rate": 10.75, "effective": "2026-09-25"}', now()),
  ('fuel_prices', '{"effective": "2026-11-04", "petrol95": {"inland": 30.24, "coastal": 29.37}, "diesel": {"inland": 30.85, "coastal": 29.98}}', now()),
  ('transfer_duty', '{"effective": "2025-04-01", "brackets": [
      {"above": 0, "base": 0, "rate": 0},
      {"above": 1210000, "base": 0, "rate": 0.03},
      {"above": 1663800, "base": 13614, "rate": 0.06},
      {"above": 2329300, "base": 53544, "rate": 0.08},
      {"above": 2994800, "base": 106784, "rate": 0.11},
      {"above": 13310000, "base": 1241456, "rate": 0.13}]}', now()),
  ('bond_costs', '{"transferPct": 1.1, "bondPct": 1.0, "fixed": 3500}', now()),
  ('tfsa_limits', '{"annual": 46000, "lifetime": 500000, "penalty_pct": 40, "from_tax_year": "2026/27"}', now()),
  ('two_pot', '{"min_withdrawal": 2000, "per_tax_year": 1}', now()),
  ('assistant_daily_cap', '30', now()),
  ('retirement_real_return_pct', '4', now()),
  ('seasons', '{"black_friday": "2026-11-27", "black_friday_window_days_after": 3, "january_window": {"start": "11-01", "end": "01-15"}}', now()),
  ('tax_tables:2026/27', '{"taxYear": "2026/27", "label": "1 Mar 2026 – 28 Feb 2027",
      "brackets": [
        {"upTo": 245100, "base": 0, "rate": 0.18, "above": 0},
        {"upTo": 383100, "base": 44118, "rate": 0.26, "above": 245100},
        {"upTo": 530200, "base": 79998, "rate": 0.31, "above": 383100},
        {"upTo": 695800, "base": 125599, "rate": 0.36, "above": 530200},
        {"upTo": 887000, "base": 185215, "rate": 0.39, "above": 695800},
        {"upTo": 1878600, "base": 259783, "rate": 0.41, "above": 887000},
        {"upTo": null, "base": 666339, "rate": 0.45, "above": 1878600}],
      "rebates": {"primary": 17820, "secondary": 9765, "tertiary": 3249},
      "thresholds": {"under65": 99000, "from65to74": 153250, "from75": 171300},
      "medicalCredit": {"member": 376, "firstDependant": 376, "additionalDependant": 254},
      "raDeductionCap": 430000}', now())
on conflict (key) do nothing;

-- The Shortcut link isn't published until Ethan builds it (docs/phase-6/SHORTCUT.md).
insert into public.app_settings (key, value, draft) values ('shortcut_url', null, '""') on conflict (key) do nothing;

-- Upcoming events as DRAFTS — placeholders, never shown to users until an admin sets the real change and publishes.
insert into public.price_events (kind, title, description, effective_on, category, change_amount, change_unit, region, status)
select 'fuel', 'Fuel price adjustment', 'Placeholder — set the DMPR figure (c/l) when it''s announced, then publish.', '2026-12-02', 'transport', 0, 'c/l', 'inland', 'draft'
where not exists (select 1 from public.price_events where title = 'Fuel price adjustment' and effective_on = '2026-12-02');
insert into public.price_events (kind, title, description, effective_on, category, change_pct, region, status)
select 'medical_aid', 'Medical aid contributions', 'Placeholder — set the average increase from the schemes'' 2027 announcements, then publish.', '2027-01-01', 'medical_aid', 0, 'all', 'draft'
where not exists (select 1 from public.price_events where title = 'Medical aid contributions' and effective_on = '2027-01-01');

-- ---------------------------------------------------------------------------------------------------------
-- The user's own expected increases on an expense ("goes up every January by 9%")
-- ---------------------------------------------------------------------------------------------------------
alter table public.expenses
  add column if not exists increase_month int,
  add column if not exists increase_pct numeric;
alter table public.expenses drop constraint if exists expenses_increase_month_check;
alter table public.expenses add constraint expenses_increase_month_check check (increase_month between 1 and 12);
alter table public.expenses drop constraint if exists expenses_increase_pct_check;
alter table public.expenses add constraint expenses_increase_pct_check check (increase_pct between -100 and 200);

-- ---------------------------------------------------------------------------------------------------------
-- Renewals and challenges
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.renewals (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  name          text        not null check (char_length(name) between 1 and 80),
  kind          text        not null check (kind in ('insurance', 'contract', 'warranty', 'subscription', 'licence', 'other')),
  provider      text        check (char_length(provider) <= 80),
  amount        numeric     check (amount >= 0),
  frequency     text        not null default 'monthly' check (frequency in ('monthly', 'annual', 'once-off')),
  renews_on     date        not null,
  expense_id    uuid        references public.expenses on delete set null,
  reminder_days int         not null default 30 check (reminder_days between 0 and 120),
  notes         text        check (char_length(notes) <= 1000),
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists renewals_user on public.renewals (user_id, renews_on);

create table if not exists public.challenges (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  kind       text        not null check (kind in ('no_spend_weekend', '52_week', 'cook_at_home', 'custom')),
  title      text        not null check (char_length(title) between 1 and 80),
  starts_on  date        not null,
  ends_on    date        not null,
  settings   jsonb       not null default '{}' check (pg_column_size(settings) <= 4000),
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
  amount_saved numeric not null default 0 check (amount_saved >= 0),
  auto         boolean not null default false,
  unique (challenge_id, day)
);

do $$ declare t text; begin
  foreach t in array array['renewals','challenges','challenge_checkins'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['renewals','challenges','app_settings','price_events'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.loot_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

create policy "Users manage their own rows" on public.renewals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own rows" on public.challenges for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own rows" on public.challenge_checkins for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = auth.uid()));

select public.add_suspension_policies(array['renewals','challenges','challenge_checkins']);

insert into public.feature_flags (key, description) values
  ('renewals', 'Phase 6 B5 — renewals & price changes'),
  ('challenges', 'Phase 6 B5 — savings challenges')
on conflict (key) do nothing;

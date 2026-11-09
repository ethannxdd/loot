-- =============================================================================================================
-- Migration 026 — Live Loot (Phase 6, batch B1)
-- Payday-to-payday cycles, the spend log (spend_entries + merchant memory), and the `live_cycle` feature flag.
-- Safe to run twice. Needs Migration 025 (is_suspended, feature_flags).
--
-- Deviations from the draft in docs/phase-6/LOOT-PHASE-6-SCHEMA.md:
--   * The updated_at trigger function is created here as public.loot_set_updated_at() — the earlier migrations
--     aren't in the repo, so a uniquely named function avoids clobbering any existing set_updated_at().
--   * spend_entries.amount is limited to ±10 000 000 and merchant/note to 120/500 characters, so a typo or a
--     runaway Shortcut can't write absurd rows.
--   * add_suspension_policies() is `security invoker` (it's only ever run by the migration owner) and locked down
--     to nobody but the owner.
-- =============================================================================================================

-- ---------------------------------------------------------------------------------------------------------
-- Helpers (later migrations reuse both)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.loot_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

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

-- ---------------------------------------------------------------------------------------------------------
-- Payday settings on the profile
-- ---------------------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists payday_day int,                                  -- null = calendar month
  add column if not exists payday_rule text not null default 'previous_working_day',
  add column if not exists payday_prompt_dismissed_at timestamptz,
  add column if not exists last_payday_seen text;                          -- cycle key; drives the payday moment once

alter table public.profiles drop constraint if exists profiles_payday_day_check;
alter table public.profiles add constraint profiles_payday_day_check check (payday_day between 1 and 31);
alter table public.profiles drop constraint if exists profiles_payday_rule_check;
alter table public.profiles add constraint profiles_payday_rule_check
  check (payday_rule in ('previous_working_day', 'next_working_day', 'exact', 'last_working_day'));

-- ---------------------------------------------------------------------------------------------------------
-- Spend log
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.spend_entries (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  amount        numeric     not null check (amount <> 0 and abs(amount) <= 10000000),  -- negative = money back
  merchant      text        check (char_length(merchant) <= 120),
  note          text        check (char_length(note) <= 500),
  category      text,                                                   -- null = "To sort"
  spent_at      timestamptz not null default now(),                     -- cycle is derived, never stored
  source        text        not null default 'manual' check (source in ('manual', 'apple_pay', 'split', 'stokvel')),
  source_id     uuid,                                                   -- split_shares.id / once_off_income.id
  external_hash text,                                                   -- dedupe for auto-capture
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists spend_entries_user_time on public.spend_entries (user_id, spent_at desc) where deleted_at is null;
create unique index if not exists spend_entries_dedupe on public.spend_entries (user_id, external_hash) where external_hash is not null;

drop trigger if exists spend_entries_updated_at on public.spend_entries;
create trigger spend_entries_updated_at before update on public.spend_entries
  for each row execute function public.loot_set_updated_at();

create table if not exists public.spend_merchant_rules (
  user_id      uuid        not null references auth.users on delete cascade,
  merchant_key text        not null check (char_length(merchant_key) between 1 and 120),
  category     text        not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, merchant_key)
);

drop trigger if exists spend_merchant_rules_updated_at on public.spend_merchant_rules;
create trigger spend_merchant_rules_updated_at before update on public.spend_merchant_rules
  for each row execute function public.loot_set_updated_at();

alter table public.spend_entries        enable row level security;
alter table public.spend_merchant_rules enable row level security;

drop policy if exists "Users manage their spend entries" on public.spend_entries;
create policy "Users manage their spend entries" on public.spend_entries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their merchant rules" on public.spend_merchant_rules;
create policy "Users manage their merchant rules" on public.spend_merchant_rules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.spend_entries, public.spend_merchant_rules from anon;
grant select, insert, update, delete on public.spend_entries, public.spend_merchant_rules to authenticated;

select public.add_suspension_policies(array['spend_entries', 'spend_merchant_rules']);

-- ---------------------------------------------------------------------------------------------------------
-- Feature flag (off for everyone; switch on per person in Admin → Feature flags)
-- ---------------------------------------------------------------------------------------------------------
insert into public.feature_flags (key, description) values
  ('live_cycle', 'Phase 6 B1 — payday cycles, Safe to spend, spend log and Budgets')
on conflict (key) do nothing;

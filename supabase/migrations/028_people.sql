-- =============================================================================================================
-- Migration 028 — People (Phase 6, batch B3)
-- Stokvels (private tracking: members are names only — D8, POPIA), once-off income (stokvel payouts etc.),
-- Splits & IOUs, the user's own PayShap ShapID, and the `stokvels` / `splits` flags. Safe to run twice.
--
-- Deviations from the draft:
--   * Child tables (stokvel_members, stokvel_payments, split_shares) get separate policies whose WITH CHECK also
--     requires the parent row to belong to the user, as the draft's note asks.
--   * Length limits on free-text columns; updated_at triggers via public.loot_set_updated_at() (Migration 026).
--   * payshap_id is limited to 40 characters of letters, digits, @ . - _ (it's the user's own handle).
-- =============================================================================================================

alter table public.profiles add column if not exists payshap_id text;
alter table public.profiles drop constraint if exists profiles_payshap_id_check;
alter table public.profiles add constraint profiles_payshap_id_check check (payshap_id is null or payshap_id ~ '^[A-Za-z0-9@._+-]{2,40}$');

create table if not exists public.stokvels (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users on delete cascade,
  name                  text        not null check (char_length(name) between 1 and 80),
  type                  text        not null check (type in ('rotating', 'savings', 'grocery', 'burial', 'investment')),
  contribution_amount   numeric     not null check (contribution_amount > 0 and contribution_amount <= 1000000),
  frequency             text        not null default 'monthly' check (frequency in ('monthly', 'weekly', 'fortnightly')),
  contribution_day      int         check (contribution_day between 1 and 31),
  start_month           date        not null,
  member_count          int         not null check (member_count between 2 and 200),
  my_position           int         check (my_position between 1 and 200),
  payout_date           date,
  expected_interest_pct numeric     check (expected_interest_pct between 0 and 50),
  expense_id            uuid        references public.expenses on delete set null,
  ended_at              timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists stokvels_user on public.stokvels (user_id);

create table if not exists public.stokvel_members (
  id          uuid primary key default gen_random_uuid(),
  stokvel_id  uuid not null references public.stokvels on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),   -- names only; no phone numbers (POPIA)
  position    int,
  is_me       boolean not null default false,
  paid_out_on date
);
create index if not exists stokvel_members_stokvel on public.stokvel_members (stokvel_id);

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
  label       text        not null check (char_length(label) between 1 and 80),
  amount      numeric     not null check (amount > 0),
  expected_on date        not null,
  kind        text        not null default 'other' check (kind in ('stokvel', 'bonus', 'refund', 'other')),
  source_id   uuid,
  received_on date,
  handled_as  text        check (handled_as in ('cycle', 'goal')),
  goal_id     uuid        references public.savings_goals on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists once_off_income_user on public.once_off_income (user_id, expected_on);

create table if not exists public.splits (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  title          text        not null check (char_length(title) between 1 and 80),
  total          numeric     not null check (total > 0 and total <= 10000000),
  spent_on       date        not null default current_date,
  paid_by        text        not null check (paid_by in ('me', 'other')),
  payer_name     text        check (char_length(payer_name) <= 60),
  split_mode     text        not null default 'equal' check (split_mode in ('equal', 'amounts', 'shares')),
  spend_entry_id uuid        references public.spend_entries on delete set null,
  note           text        check (char_length(note) <= 500),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists splits_user on public.splits (user_id, spent_on desc);

create table if not exists public.split_shares (
  id               uuid        primary key default gen_random_uuid(),
  split_id         uuid        not null references public.splits on delete cascade,
  user_id          uuid        not null references auth.users on delete cascade,
  person_name      text        not null check (char_length(person_name) between 1 and 60),
  is_me            boolean     not null default false,
  amount           numeric     not null check (amount >= 0),
  settled_amount   numeric     not null default 0 check (settled_amount >= 0),
  settled_at       timestamptz,
  last_reminded_at timestamptz,
  reminders_sent   int         not null default 0
);
create index if not exists split_shares_open on public.split_shares (user_id) where settled_at is null;
create index if not exists split_shares_split on public.split_shares (split_id);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['stokvels','once_off_income','splits'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.loot_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- RLS: own rows; child tables also require the parent to be yours.
do $$ declare t text; begin
  foreach t in array array['stokvels','stokvel_members','stokvel_payments','once_off_income','splits','split_shares'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create policy "Users manage their own rows" on public.stokvels for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own rows" on public.once_off_income for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own rows" on public.splits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own rows" on public.stokvel_members for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.stokvels s where s.id = stokvel_id and s.user_id = auth.uid()));
create policy "Users manage their own rows" on public.stokvel_payments for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.stokvels s where s.id = stokvel_id and s.user_id = auth.uid()));
create policy "Users manage their own rows" on public.split_shares for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.splits s where s.id = split_id and s.user_id = auth.uid()));

select public.add_suspension_policies(array['stokvels','stokvel_members','stokvel_payments','once_off_income','splits','split_shares']);

insert into public.feature_flags (key, description) values
  ('stokvels', 'Phase 6 B3 — stokvel tracking'),
  ('splits', 'Phase 6 B3 — splits & IOUs')
on conflict (key) do nothing;

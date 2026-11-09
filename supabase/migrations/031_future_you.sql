-- =============================================================================================================
-- Migration 031 — Future you + Ask Loot (Phase 6, batch B6)
-- TFSA contributions, the retirement profile, the Ask Loot daily cap (assistant_usage + use_assistant_question) and
-- the `future_you` flag (`assistant` already exists from 025). Safe to run twice. Needs 030 (app_settings).
--
-- Deviations from the draft:
--   * assistant_usage also counts `calls` (every request to the model, including tool follow-ups) with a hard cap of
--     5 × the question cap, so the question cap can't be side-stepped by sending only "continue" requests.
--   * use_assistant_question(p_kind default 'question') — 'question' counts a question, 'continue' only counts a call.
--     A refused request doesn't count. Calling it with no argument behaves like the draft.
--   * my_assistant_usage() for Settings → Your data ("Ask Loot today: 3 of 30").
--   * tax_year must look like '2026/27'.
-- =============================================================================================================

create table if not exists public.tfsa_contributions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  tax_year       text        not null check (tax_year ~ '^\d{4}/\d{2}$'),
  amount         numeric     not null check (amount > 0 and amount <= 10000000),
  contributed_on date        not null,
  provider       text        check (char_length(provider) <= 80),
  note           text        check (char_length(note) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tfsa_contributions_user on public.tfsa_contributions (user_id, tax_year);

create table if not exists public.retirement_profile (
  user_id               uuid        primary key references auth.users on delete cascade,
  retirement_age        int         not null default 65 check (retirement_age between 40 and 80),
  ra_balance            numeric     not null default 0 check (ra_balance >= 0),
  pension_balance       numeric     not null default 0 check (pension_balance >= 0),
  savings_pot_balance   numeric     not null default 0 check (savings_pot_balance >= 0),
  monthly_contribution  numeric     not null default 0 check (monthly_contribution >= 0),
  employer_contribution numeric     not null default 0 check (employer_contribution >= 0),
  real_return_pct       numeric     check (real_return_pct between -5 and 15),
  desired_income        numeric     check (desired_income >= 0),
  current_age           int         check (current_age between 16 and 100),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- Added after the draft: the two-pot calculator remembers the savings-pot balance, and the projection needs an age.
alter table public.retirement_profile add column if not exists savings_pot_balance numeric not null default 0;
alter table public.retirement_profile add column if not exists current_age int;

do $$ declare t text; begin
  foreach t in array array['tfsa_contributions','retirement_profile'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('create policy "Users manage their own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.loot_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
select public.add_suspension_policies(array['tfsa_contributions','retirement_profile']);

-- ---------------------------------------------------------------------------------------------------------
-- Ask Loot daily cap (Rule 25). RPC only.
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.assistant_usage (
  user_id   uuid not null references auth.users on delete cascade,
  day       date not null,
  questions int  not null default 0,
  calls     int  not null default 0,
  primary key (user_id, day)
);
alter table public.assistant_usage add column if not exists calls int not null default 0;
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon, authenticated;

create or replace function public.assistant_cap() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::int
                               when jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^\d+$' then (value #>> '{}')::int end
                   from public.app_settings where key = 'assistant_daily_cap'), 30);
$$;
revoke all on function public.assistant_cap() from public, anon, authenticated;

-- A zero-argument overload would be ambiguous with the defaulted parameter, so make sure none exists.
drop function if exists public.use_assistant_question();

-- Called by the loot-assistant edge function with the user's own token before each model request.
-- Returns questions left today; raises 'daily limit reached' (nothing is counted then).
create or replace function public.use_assistant_question(p_kind text default 'question')
returns int language plpgsql security definer set search_path = public as $$
declare
  cap   int  := public.assistant_cap();
  today date := (now() at time zone 'Africa/Johannesburg')::date;
  q     int;
  c     int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.is_suspended() then raise exception 'account suspended'; end if;
  select questions, calls into q, c from public.assistant_usage where user_id = auth.uid() and day = today for update;
  q := coalesce(q, 0);
  c := coalesce(c, 0);
  if (p_kind = 'question' and q >= cap) or c >= cap * 5 then
    raise exception 'daily limit reached';
  end if;
  insert into public.assistant_usage (user_id, day, questions, calls)
  values (auth.uid(), today, case when p_kind = 'question' then 1 else 0 end, 1)
  on conflict (user_id, day) do update set
    questions = public.assistant_usage.questions + case when p_kind = 'question' then 1 else 0 end,
    calls = public.assistant_usage.calls + 1;
  return cap - (q + case when p_kind = 'question' then 1 else 0 end);
end $$;

create or replace function public.my_assistant_usage()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'used', coalesce((select questions from public.assistant_usage
                      where user_id = auth.uid() and day = (now() at time zone 'Africa/Johannesburg')::date), 0),
    'cap', public.assistant_cap());
$$;

revoke all on function public.use_assistant_question(text), public.my_assistant_usage() from public, anon;
grant execute on function public.use_assistant_question(text), public.my_assistant_usage() to authenticated;

insert into public.feature_flags (key, description) values
  ('future_you', 'Phase 6 B6 — TFSA, retirement and two-pot')
on conflict (key) do nothing;
update public.feature_flags set description = 'Ask Loot — Gemini, grounded in your numbers with tool calls (Phase 6 B6). Turn on Gemini billing before switching it on for everyone (D14).'
where key = 'assistant';

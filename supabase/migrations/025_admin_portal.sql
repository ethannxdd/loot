-- =====================================================================================================
-- Migration 025 — Admin portal
-- =====================================================================================================
-- Adds everything the /admin portal needs: admin roles, account suspension, feature flags, a once-a-day
-- activity ping and an append-only audit log, plus the functions the portal calls.
--
-- Security model (see claude/LOOT-ADMIN-PORTAL.md):
--   * Admin data is never read straight from tables. The new tables have RLS on and no client policies;
--     the portal calls `admin_*` functions, which are SECURITY DEFINER and start with admin_require(role).
--   * admin_require() also insists on a two-factor (aal2) session.
--   * Every change an admin makes is written to admin_audit_log, which nobody can edit or delete.
--   * Suspended accounts become read-only at the database level (restrictive policies below), so a
--     suspended person can still sign in, see why, and export their data — but can't change anything.
--   * Auth-level actions (confirm email, reset links, sign out everywhere, delete account) need the
--     service-role key, so they live in the `admin-actions` edge function, which applies the same checks.
--
-- Safe to run more than once. After running it, make yourself the first Owner (once):
--   insert into public.admin_users (user_id, role)
--   select id, 'owner' from auth.users where email = 'you@example.com';
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------------------------------

create table if not exists public.admin_users (
  user_id    uuid        primary key references auth.users on delete cascade,
  role       text        not null check (role in ('owner', 'support', 'viewer')),
  added_by   uuid        references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_status (
  user_id             uuid        primary key references auth.users on delete cascade,
  status              text        not null default 'active' check (status in ('active', 'suspended')),
  reason              text,
  suspended_until     timestamptz,             -- null = until lifted
  sessions_revoked_at timestamptz,             -- set by "Sign out everywhere"; the app signs out older sessions
  updated_by          uuid        references auth.users on delete set null,
  updated_at          timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key              text        primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  description      text        not null default '',
  enabled_globally boolean     not null default false,
  is_public        boolean     not null default false,  -- readable before sign-in (e.g. on the sign-in page)
  updated_by       uuid        references auth.users on delete set null,
  updated_at       timestamptz not null default now()
);

create table if not exists public.user_feature_overrides (
  user_id    uuid        not null references auth.users on delete cascade,
  flag_key   text        not null references public.feature_flags (key) on delete cascade on update cascade,
  enabled    boolean     not null,
  reason     text,
  set_by     uuid        references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, flag_key)
);

-- One row per user per day the app was opened. No pages, clicks or amounts.
create table if not exists public.app_activity (
  user_id  uuid not null references auth.users on delete cascade,
  day      date not null,
  platform text not null check (platform in ('browser', 'pwa', 'ios', 'android')),
  primary key (user_id, day)
);
create index if not exists app_activity_day_idx on public.app_activity (day);

-- Append-only. No foreign key on the target, so entries survive account deletion (the email is kept).
create table if not exists public.admin_audit_log (
  id             bigint      generated always as identity primary key,
  admin_id       uuid        references auth.users on delete set null,
  admin_email    text,
  action         text        not null,
  target_user_id uuid,
  target_email   text,
  reason         text,
  details        jsonb       not null default '{}',
  created_at     timestamptz not null default now()
);
create index if not exists admin_audit_target_idx  on public.admin_audit_log (target_user_id, created_at desc);
create index if not exists admin_audit_admin_idx   on public.admin_audit_log (admin_id, created_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_log (created_at desc);

create or replace function public.admin_audit_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'The admin audit log is append-only.';
end;
$$;
drop trigger if exists admin_audit_log_no_update on public.admin_audit_log;
create trigger admin_audit_log_no_update before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();

-- RLS on everything. Only account_status gets a client policy (read your own row).
alter table public.admin_users            enable row level security;
alter table public.account_status         enable row level security;
alter table public.feature_flags          enable row level security;
alter table public.user_feature_overrides enable row level security;
alter table public.app_activity           enable row level security;
alter table public.admin_audit_log        enable row level security;

revoke all on public.admin_users, public.feature_flags, public.user_feature_overrides,
              public.app_activity, public.admin_audit_log from anon, authenticated;
revoke all on public.account_status from anon, authenticated;
grant select on public.account_status to authenticated;

drop policy if exists "Users can read their own account status" on public.account_status;
create policy "Users can read their own account status" on public.account_status
  for select to authenticated using (auth.uid() = user_id);

-- Starting flags (the Assistant moves from a code change to a switch).
insert into public.feature_flags (key, description, enabled_globally, is_public) values
  ('assistant', 'Loot Assistant — the Gemini chat. Parked for everyone since Sept 2026; turn on per user to test.', false, false),
  ('email_codes', '6-digit email sign-in codes for the installed app. Needs {{ .Token }} in the Supabase Magic Link and Confirm signup templates (custom SMTP).', false, true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------------------------------

create or replace function public.admin_rank(r text) returns int
language sql immutable as $$
  select case r when 'owner' then 3 when 'support' then 2 when 'viewer' then 1 else 0 end
$$;

-- Raises unless the caller is an admin of at least `min_role` on a two-factor session. Returns their id.
create or replace function public.admin_require(min_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r text;
begin
  if auth.uid() is null then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select role into r from public.admin_users where user_id = auth.uid();
  if r is null or public.admin_rank(r) < public.admin_rank(min_role) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'two-factor required' using errcode = '42501', hint = 'mfa';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.admin_log(p_action text, p_target uuid, p_reason text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (admin_id, admin_email, action, target_user_id, target_email, reason, details)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    p_action,
    p_target,
    (select email from auth.users where id = p_target),
    nullif(btrim(coalesce(p_reason, '')), ''),
    coalesce(p_details, '{}'::jsonb)
  );
$$;

create or replace function public.admin_require_target(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'That account no longer exists.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_require_reason(p_reason text) returns void
language plpgsql immutable as $$
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Add a short reason — it goes in the audit log.' using errcode = '22023';
  end if;
end;
$$;

-- True when the signed-in user is suspended right now. Used by the restrictive policies below.
create or replace function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_status
    where user_id = auth.uid()
      and status = 'suspended'
      and (suspended_until is null or suspended_until > now())
  );
$$;

-- -----------------------------------------------------------------------------------------------------
-- Suspended accounts are read-only: restrictive policies AND-ed with every existing policy.
-- Reads stay allowed (so people can export their data). Account deletion still works (service role).
-- -----------------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'expenses', 'income_streams', 'savings_goals', 'goal_contributions', 'monthly_snapshots',
    'affordability_checks', 'planner_plans', 'debts', 'net_worth_items', 'notifications', 'spending_alerts',
    'statement_analyses', 'subscription_reviews', 'tax_profile', 'tax_year_data', 'budge_scores',
    'bureau_scores', 'score_calibration', 'assistant_conversations', 'assistant_messages', 'households',
    'household_members', 'household_invites', 'monthly_briefings'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists "Suspended: no inserts" on public.%I', t);
    execute format('drop policy if exists "Suspended: no updates" on public.%I', t);
    execute format('drop policy if exists "Suspended: no deletes" on public.%I', t);
    execute format('create policy "Suspended: no inserts" on public.%I as restrictive for insert to authenticated with check (not (select public.is_suspended()))', t);
    execute format('create policy "Suspended: no updates" on public.%I as restrictive for update to authenticated using (not (select public.is_suspended()))', t);
    execute format('create policy "Suspended: no deletes" on public.%I as restrictive for delete to authenticated using (not (select public.is_suspended()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Functions every signed-in user can call
-- -----------------------------------------------------------------------------------------------------

-- The caller's admin role (null for everyone else) and session level. Doesn't need two-factor, so the
-- portal can guide a new admin through enrolment.
create or replace function public.admin_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', (select role from public.admin_users where user_id = auth.uid()),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
  );
$$;

create or replace function public.my_account_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', case when public.is_suspended() then 'suspended' else 'active' end,
    'reason', case when public.is_suspended() then s.reason end,
    'suspended_until', case when public.is_suspended() then s.suspended_until end,
    'sessions_revoked_at', s.sessions_revoked_at
  )
  from (select 1) one
  left join public.account_status s on s.user_id = auth.uid();
$$;

create or replace function public.my_feature_flags() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(f.key, coalesce(o.enabled, f.enabled_globally)), '{}'::jsonb)
  from public.feature_flags f
  left join public.user_feature_overrides o on o.flag_key = f.key and o.user_id = auth.uid();
$$;

create or replace function public.public_feature_flags() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, enabled_globally), '{}'::jsonb)
  from public.feature_flags where is_public;
$$;

create or replace function public.track_activity(p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.app_activity (user_id, day, platform)
  values (
    auth.uid(),
    (now() at time zone 'Africa/Johannesburg')::date,
    case when p_platform in ('browser', 'pwa', 'ios', 'android') then p_platform else 'browser' end
  )
  on conflict (user_id, day) do update set platform = excluded.platform;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Portal reads (Viewer and up)
-- -----------------------------------------------------------------------------------------------------

create or replace function public.admin_overview_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'Africa/Johannesburg';
  v_today date := (now() at time zone tz)::date;
  v_all boolean := coalesce(p_days, 0) <= 0;
  v_days int := case when coalesce(p_days, 0) <= 0 then 90 else least(p_days, 366) end;
  v_start date;
  v_cohort_start timestamptz;
  v_prev_start date;
  v_active_range int;
  v_onboarded int;
  v_basis text;
  v_denominator int;
  result jsonb;
begin
  perform public.admin_require('viewer');
  v_start := v_today - (v_days - 1);
  v_prev_start := v_start - v_days;
  v_cohort_start := case when v_all then '-infinity'::timestamptz else (v_start::timestamp at time zone tz) end;

  select count(distinct user_id) into v_active_range from public.app_activity where day >= v_start;
  select count(*) into v_onboarded from public.profiles where onboarded_at is not null;
  v_basis := case when v_active_range > 0 then 'active' else 'onboarded' end;
  v_denominator := greatest(case when v_active_range > 0 then v_active_range else v_onboarded end, 0);

  with
  latest_platform as (
    select distinct on (user_id) user_id, platform
    from public.app_activity where day >= v_start
    order by user_id, day desc
  ),
  basis_users as (
    select user_id from public.app_activity where v_basis = 'active' and day >= v_start
    union
    select id from public.profiles where v_basis = 'onboarded' and onboarded_at is not null
  ),
  cohort as (
    select u.id, u.email_confirmed_at from auth.users u where u.created_at >= v_cohort_start
  )
  select jsonb_build_object(
    'range_days', case when v_all then 0 else v_days end,
    'series_days', v_days,
    'users_total', (select count(*) from auth.users),
    'new_in_range', (select count(*) from cohort),
    'new_prev_range', case when v_all then null else (
      select count(*) from auth.users
      where created_at >= (v_prev_start::timestamp at time zone tz) and created_at < v_cohort_start) end,
    'active_today', (select count(distinct user_id) from public.app_activity where day = v_today),
    'active_7d', (select count(distinct user_id) from public.app_activity where day > v_today - 7),
    'active_30d', (select count(distinct user_id) from public.app_activity where day > v_today - 30),
    'active_in_range', v_active_range,
    'peak_day', (
      select jsonb_build_object('day', day, 'active', n) from (
        select day, count(*) n from public.app_activity where day > v_today - 7 group by day order by n desc, day desc limit 1
      ) p),
    'platforms', jsonb_build_object(
      'browser', (select count(*) from latest_platform where platform = 'browser'),
      'pwa',     (select count(*) from latest_platform where platform = 'pwa'),
      'ios',     (select count(*) from latest_platform where platform = 'ios'),
      'android', (select count(*) from latest_platform where platform = 'android')),
    'signin', jsonb_build_object(
      'email',  (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', 'email') = 'email'),
      'google', (select count(*) from auth.users where raw_app_meta_data ->> 'provider' = 'google'),
      'other',  (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', 'email') not in ('email', 'google'))),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d,
        'signups', (select count(*) from auth.users u where (u.created_at at time zone tz)::date = d),
        'active', (select count(*) from public.app_activity a where a.day = d)
      ) order by d), '[]'::jsonb)
      from generate_series(v_start, v_today, interval '1 day') g(dd), lateral (select dd::date d) x),
    'funnel', jsonb_build_object(
      'signed_up',     (select count(*) from cohort),
      'confirmed',     (select count(*) from cohort where email_confirmed_at is not null),
      'onboarded',     (select count(*) from cohort c join public.profiles p on p.id = c.id where p.onboarded_at is not null),
      'first_expense', (select count(*) from cohort c where exists (select 1 from public.expenses e where e.user_id = c.id)),
      'three_months',  (select count(*) from cohort c where (select count(distinct month) from public.monthly_snapshots s where s.user_id = c.id) >= 3)),
    'adoption_basis', v_basis,
    'adoption_total', v_denominator,
    'adoption', jsonb_build_object(
      'expenses',   (select count(*) from basis_users b where exists (select 1 from public.expenses x where x.user_id = b.user_id)),
      'goals',      (select count(*) from basis_users b where exists (select 1 from public.savings_goals x where x.user_id = b.user_id)),
      'checker',    (select count(*) from basis_users b where exists (select 1 from public.affordability_checks x where x.user_id = b.user_id)),
      'statements', (select count(*) from basis_users b where exists (select 1 from public.statement_analyses x where x.user_id = b.user_id)),
      'planner',    (select count(*) from basis_users b where exists (select 1 from public.planner_plans x where x.user_id = b.user_id)),
      'tax',        (select count(*) from basis_users b where exists (select 1 from public.tax_profile x where x.user_id = b.user_id)),
      'close',      (select count(*) from basis_users b where exists (select 1 from public.monthly_snapshots x where x.user_id = b.user_id and x.locked_at is not null)),
      'bureau',     (select count(*) from basis_users b where exists (select 1 from public.bureau_scores x where x.user_id = b.user_id)),
      'household',  (select count(*) from basis_users b where exists (select 1 from public.household_members x where x.user_id = b.user_id))),
    'benchmarks', (
      select jsonb_object_agg(b, coalesce((select max(sample_size) from public.spending_benchmarks s where s.income_bracket = b), 0))
      from unnest(array['under_10k', '10k_20k', '20k_35k', '35k_60k', '60k_plus']) b),
    'attention', jsonb_build_object(
      'unconfirmed', (select count(*) from auth.users where email_confirmed_at is null and created_at < now() - interval '48 hours'),
      'stuck',       (select count(*) from auth.users u join public.profiles p on p.id = u.id
                       where p.onboarded_at is null and u.created_at < now() - interval '7 days'),
      'suspended',   (select count(*) from public.account_status
                       where status = 'suspended' and (suspended_until is null or suspended_until > now())),
      'next_unsuspend', (select min(suspended_until) from public.account_status
                       where status = 'suspended' and suspended_until > now()))
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_list_users(
  p_search text default null,
  p_filter text default 'all',
  p_platform text default null,
  p_limit int default 25,
  p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  result jsonb;
begin
  perform public.admin_require('viewer');

  with base as (
    select
      u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
      p.display_name, p.onboarded_at,
      (s.status = 'suspended' and (s.suspended_until is null or s.suspended_until > now())) is true as suspended,
      la.day as last_active_day, la.platform,
      a.role as admin_role
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.account_status s on s.user_id = u.id
    left join public.admin_users a on a.user_id = u.id
    left join lateral (
      select day, platform from public.app_activity x where x.user_id = u.id order by day desc limit 1
    ) la on true
  ),
  filtered as (
    select * from base b
    where (v_search is null or b.email ilike '%' || v_search || '%' or b.display_name ilike '%' || v_search || '%')
      and (p_platform is null or b.platform = p_platform)
      and case coalesce(p_filter, 'all')
        when 'active'      then not b.suspended and b.email_confirmed_at is not null
        when 'unconfirmed' then b.email_confirmed_at is null
        when 'suspended'   then b.suspended
        when 'stuck'       then b.onboarded_at is null and b.created_at < now() - interval '7 days'
        when 'admins'      then b.admin_role is not null
        else true
      end
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'email', f.email,
        'display_name', f.display_name,
        'status', case when f.suspended then 'suspended' when f.email_confirmed_at is null then 'unconfirmed' else 'active' end,
        'created_at', f.created_at,
        'last_sign_in_at', f.last_sign_in_at,
        'last_active_day', f.last_active_day,
        'onboarded', f.onboarded_at is not null,
        'platform', f.platform,
        'provider', f.provider,
        'admin_role', f.admin_role
      ) order by f.created_at desc)
      from (select * from filtered order by created_at desc limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(coalesce(p_offset, 0), 0)) f
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'Africa/Johannesburg';
  v_today date := (now() at time zone tz)::date;
  result jsonb;
begin
  perform public.admin_require('viewer');
  perform public.admin_require_target(p_user);

  select jsonb_build_object(
    'account', jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'display_name', p.display_name,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'email_confirmed_at', u.email_confirmed_at,
      'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
      'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
      'onboarded_at', p.onboarded_at,
      'tutorial_completed', coalesce(p.tutorial_completed, false),
      'in_household', exists (select 1 from public.household_members m where m.user_id = u.id)
                      or exists (select 1 from public.households h where h.owner_id = u.id),
      'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
      'admin_role', (select role from public.admin_users a where a.user_id = u.id)
    ),
    'status', jsonb_build_object(
      'status', case when (s.status = 'suspended' and (s.suspended_until is null or s.suspended_until > now())) then 'suspended' else 'active' end,
      'reason', s.reason,
      'suspended_until', s.suspended_until,
      'sessions_revoked_at', s.sessions_revoked_at,
      'updated_at', s.updated_at,
      'updated_by_email', (select email from auth.users x where x.id = s.updated_by)
    ),
    'usage', jsonb_build_object(
      'expenses',      (select count(*) from public.expenses x where x.user_id = u.id and x.deleted_at is null),
      'goals',         (select count(*) from public.savings_goals x where x.user_id = u.id),
      'checks',        (select count(*) from public.affordability_checks x where x.user_id = u.id),
      'statements',    (select count(*) from public.statement_analyses x where x.user_id = u.id),
      'plans',         (select count(*) from public.planner_plans x where x.user_id = u.id),
      'months',        (select count(*) from public.monthly_snapshots x where x.user_id = u.id),
      'notifications', (select count(*) from public.notifications x where x.user_id = u.id),
      'tax_profile',   exists (select 1 from public.tax_profile x where x.user_id = u.id)
    ),
    'locked_months', coalesce((
      select jsonb_agg(x.month order by x.month desc) from public.monthly_snapshots x
      where x.user_id = u.id and x.locked_at is not null), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('day', a.day, 'platform', a.platform) order by a.day)
      from public.app_activity a where a.user_id = u.id and a.day > v_today - 30), '[]'::jsonb),
    'last_active', (
      select jsonb_build_object('day', a.day, 'platform', a.platform)
      from public.app_activity a where a.user_id = u.id order by a.day desc limit 1),
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', f.key,
        'description', f.description,
        'enabled_globally', f.enabled_globally,
        'override', o.enabled,
        'override_reason', o.reason,
        'effective', coalesce(o.enabled, f.enabled_globally)
      ) order by f.key)
      from public.feature_flags f
      left join public.user_feature_overrides o on o.flag_key = f.key and o.user_id = u.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(h order by h.created_at desc) from (
        select l.id, l.action, l.admin_email, l.reason, l.details, l.created_at
        from public.admin_audit_log l where l.target_user_id = u.id
        order by l.created_at desc limit 50) h), '[]'::jsonb)
  ) into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.account_status s on s.user_id = u.id
  where u.id = p_user;

  return result;
end;
$$;

create or replace function public.admin_list_audit(
  p_target uuid default null,
  p_action text default null,
  p_limit int default 50,
  p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.admin_require('viewer');
  is_owner boolean := (select role = 'owner' from public.admin_users where user_id = me);
  result jsonb;
begin
  with rows as (
    select * from public.admin_audit_log l
    where (is_owner or l.admin_id = me)
      and (p_target is null or l.target_user_id = p_target)
      and (p_action is null or l.action = p_action)
  )
  select jsonb_build_object(
    'total', (select count(*) from rows),
    'scope', case when is_owner then 'everyone' else 'mine' end,
    'rows', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select id, admin_id, admin_email, action, target_user_id, target_email, reason, details, created_at
        from rows order by created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) r
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Fixes and access (Support and up)
-- -----------------------------------------------------------------------------------------------------

create or replace function public.admin_suspend(p_user uuid, p_reason text, p_until timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.admin_require('support');
begin
  perform public.admin_require_target(p_user);
  perform public.admin_require_reason(p_reason);
  if p_user = me then
    raise exception 'You can''t suspend your own account.' using errcode = '22023';
  end if;
  if exists (select 1 from public.admin_users where user_id = p_user) then
    raise exception 'Remove this person from the admin team before suspending them.' using errcode = '22023';
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'The end date must be in the future.' using errcode = '22023';
  end if;
  insert into public.account_status (user_id, status, reason, suspended_until, updated_by, updated_at)
  values (p_user, 'suspended', btrim(p_reason), p_until, me, now())
  on conflict (user_id) do update
    set status = 'suspended', reason = excluded.reason, suspended_until = excluded.suspended_until,
        updated_by = me, updated_at = now();
  perform public.admin_log('suspend', p_user, p_reason, jsonb_build_object('until', p_until));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_unsuspend(p_user uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.admin_require('support');
begin
  perform public.admin_require_target(p_user);
  update public.account_status
     set status = 'active', reason = null, suspended_until = null, updated_by = me, updated_at = now()
   where user_id = p_user;
  perform public.admin_log('unsuspend', p_user, p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_reset_onboarding(p_user uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  update public.profiles set onboarded_at = null, updated_at = now() where id = p_user;
  perform public.admin_log('reset_onboarding', p_user, p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_replay_tutorial(p_user uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  update public.profiles set tutorial_completed = false, updated_at = now() where id = p_user;
  perform public.admin_log('replay_tutorial', p_user, p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_unlock_month(p_user uuid, p_month text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  update public.monthly_snapshots set locked_at = null, updated_at = now()
   where user_id = p_user and month = p_month and locked_at is not null;
  if not found then
    raise exception 'That month isn''t locked.' using errcode = '22023';
  end if;
  perform public.admin_log('unlock_month', p_user, p_reason, jsonb_build_object('month', p_month));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_remove_from_household(p_user uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_members int;
  v_owned int;
  v_invites int;
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  select email into v_email from auth.users where id = p_user;
  delete from public.household_members where user_id = p_user;
  get diagnostics v_members = row_count;
  delete from public.households where owner_id = p_user;          -- cascades the partner's link and invites
  get diagnostics v_owned = row_count;
  delete from public.household_invites where lower(email) = lower(v_email) and accepted_at is null;
  get diagnostics v_invites = row_count;
  if v_members + v_owned + v_invites = 0 then
    raise exception 'This account isn''t in a household.' using errcode = '22023';
  end if;
  perform public.admin_log('remove_from_household', p_user, p_reason,
    jsonb_build_object('memberships', v_members, 'owned_households', v_owned, 'pending_invites', v_invites));
  return jsonb_build_object('ok', true, 'memberships', v_members, 'owned_households', v_owned, 'pending_invites', v_invites);
end;
$$;

create or replace function public.admin_clear_notifications(p_user uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  delete from public.notifications where user_id = p_user;
  get diagnostics v_count = row_count;
  perform public.admin_log('clear_notifications', p_user, p_reason, jsonb_build_object('deleted', v_count));
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Feature flags
-- -----------------------------------------------------------------------------------------------------

create or replace function public.admin_list_flags() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', f.key,
      'description', f.description,
      'enabled_globally', f.enabled_globally,
      'is_public', f.is_public,
      'overrides_on',  (select count(*) from public.user_feature_overrides o where o.flag_key = f.key and o.enabled),
      'overrides_off', (select count(*) from public.user_feature_overrides o where o.flag_key = f.key and not o.enabled),
      'updated_at', f.updated_at,
      'updated_by_email', (select email from auth.users x where x.id = f.updated_by)
    ) order by f.key)
    from public.feature_flags f), '[]'::jsonb);
end;
$$;

create or replace function public.admin_flag_overrides(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', o.user_id,
      'email', u.email,
      'display_name', p.display_name,
      'enabled', o.enabled,
      'reason', o.reason,
      'set_by_email', (select email from auth.users x where x.id = o.set_by),
      'created_at', o.created_at
    ) order by o.created_at desc)
    from public.user_feature_overrides o
    join auth.users u on u.id = o.user_id
    left join public.profiles p on p.id = o.user_id
    where o.flag_key = p_key), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_flag(p_key text, p_enabled boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.admin_require('owner');
begin
  update public.feature_flags set enabled_globally = p_enabled, updated_by = me, updated_at = now() where key = p_key;
  if not found then
    raise exception 'There''s no flag called %.', p_key using errcode = 'P0002';
  end if;
  perform public.admin_log('set_flag', null, p_reason, jsonb_build_object('flag', p_key, 'enabled', p_enabled));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_create_flag(p_key text, p_description text, p_public boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.admin_require('owner');
begin
  if p_key is null or p_key !~ '^[a-z][a-z0-9_]{1,40}$' then
    raise exception 'Flag names use lowercase letters, numbers and underscores, e.g. new_dashboard.' using errcode = '22023';
  end if;
  insert into public.feature_flags (key, description, is_public, updated_by)
  values (p_key, coalesce(btrim(p_description), ''), coalesce(p_public, false), me);
  perform public.admin_log('create_flag', null, null, jsonb_build_object('flag', p_key, 'public', coalesce(p_public, false)));
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'A flag called % already exists.', p_key using errcode = '23505';
end;
$$;

-- p_enabled null removes the override (the user follows the global setting again).
create or replace function public.admin_set_override(p_user uuid, p_key text, p_enabled boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.admin_require('support');
begin
  perform public.admin_require_target(p_user);
  if not exists (select 1 from public.feature_flags where key = p_key) then
    raise exception 'There''s no flag called %.', p_key using errcode = 'P0002';
  end if;
  if p_enabled is null then
    delete from public.user_feature_overrides where user_id = p_user and flag_key = p_key;
  else
    insert into public.user_feature_overrides (user_id, flag_key, enabled, reason, set_by, created_at)
    values (p_user, p_key, p_enabled, nullif(btrim(coalesce(p_reason, '')), ''), me, now())
    on conflict (user_id, flag_key) do update
      set enabled = excluded.enabled, reason = excluded.reason, set_by = me, created_at = now();
  end if;
  perform public.admin_log('set_override', p_user, p_reason, jsonb_build_object('flag', p_key, 'enabled', p_enabled));
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Team (Owner only)
-- -----------------------------------------------------------------------------------------------------

create or replace function public.admin_list_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('owner');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', a.user_id,
      'email', u.email,
      'display_name', p.display_name,
      'role', a.role,
      'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified'),
      'added_by_email', (select email from auth.users x where x.id = a.added_by),
      'created_at', a.created_at
    ) order by public.admin_rank(a.role) desc, a.created_at)
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id), '[]'::jsonb);
end;
$$;

create or replace function public.admin_add_admin(p_email text, p_role text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.admin_require('owner');
  v_user uuid;
begin
  perform public.admin_require_reason(p_reason);
  if p_role not in ('owner', 'support', 'viewer') then
    raise exception 'Unknown role.' using errcode = '22023';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No Loot account uses that email. They need to sign up first.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.admin_users where user_id = v_user) then
    raise exception 'That person is already on the team.' using errcode = '23505';
  end if;
  insert into public.admin_users (user_id, role, added_by) values (v_user, p_role, me);
  perform public.admin_log('add_admin', v_user, p_reason, jsonb_build_object('role', p_role));
  return jsonb_build_object('ok', true, 'user_id', v_user);
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old text;
begin
  perform public.admin_require('owner');
  perform public.admin_require_reason(p_reason);
  if p_role not in ('owner', 'support', 'viewer') then
    raise exception 'Unknown role.' using errcode = '22023';
  end if;
  select role into v_old from public.admin_users where user_id = p_user for update;
  if v_old is null then
    raise exception 'That person isn''t on the team.' using errcode = 'P0002';
  end if;
  if v_old = 'owner' and p_role <> 'owner' and (select count(*) from public.admin_users where role = 'owner') <= 1 then
    raise exception 'Loot needs at least one Owner. Make someone else an Owner first.' using errcode = '22023';
  end if;
  update public.admin_users set role = p_role where user_id = p_user;
  perform public.admin_log('set_role', p_user, p_reason, jsonb_build_object('from', v_old, 'to', p_role));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_remove_admin(p_user uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old text;
begin
  perform public.admin_require('owner');
  perform public.admin_require_reason(p_reason);
  select role into v_old from public.admin_users where user_id = p_user for update;
  if v_old is null then
    raise exception 'That person isn''t on the team.' using errcode = 'P0002';
  end if;
  if v_old = 'owner' and (select count(*) from public.admin_users where role = 'owner') <= 1 then
    raise exception 'Loot needs at least one Owner. Make someone else an Owner first.' using errcode = '22023';
  end if;
  delete from public.admin_users where user_id = p_user;
  perform public.admin_log('remove_admin', p_user, p_reason, jsonb_build_object('role', v_old));
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Used only by the admin-actions edge function (service role)
-- -----------------------------------------------------------------------------------------------------

-- Ends every session for a user. Deleting auth.sessions cascades their refresh tokens, so no device can
-- renew; the app also signs out any copy whose access token predates sessions_revoked_at.
create or replace function public.admin_revoke_sessions(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
begin
  begin
    delete from auth.sessions where user_id = p_user;
    get diagnostics v_count = row_count;
  exception when insufficient_privilege then
    v_count := -1;  -- the app-side check below still signs every device out within a minute
  end;
  insert into public.account_status (user_id, sessions_revoked_at, updated_at)
  values (p_user, now(), now())
  on conflict (user_id) do update set sessions_revoked_at = now(), updated_at = now();
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------------------------------
-- Grants: internal helpers are callable by nobody from the API; portal functions by signed-in users only
-- (each one checks the admin role itself); edge-function helpers by the service role only.
-- -----------------------------------------------------------------------------------------------------

revoke all on function public.admin_rank(text)                         from public, anon, authenticated;
revoke all on function public.admin_require(text)                      from public, anon, authenticated;
revoke all on function public.admin_log(text, uuid, text, jsonb)       from public, anon, authenticated;
revoke all on function public.admin_require_target(uuid)               from public, anon, authenticated;
revoke all on function public.admin_require_reason(text)               from public, anon, authenticated;
revoke all on function public.admin_audit_log_immutable()              from public, anon, authenticated;
revoke all on function public.admin_revoke_sessions(uuid)              from public, anon, authenticated;
grant execute on function public.admin_revoke_sessions(uuid) to service_role;

revoke all on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

revoke all on function public.public_feature_flags() from public;
grant execute on function public.public_feature_flags() to anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_me()',
    'public.my_account_status()',
    'public.my_feature_flags()',
    'public.track_activity(text)',
    'public.admin_overview_stats(int)',
    'public.admin_list_users(text, text, text, int, int)',
    'public.admin_user_detail(uuid)',
    'public.admin_list_audit(uuid, text, int, int)',
    'public.admin_suspend(uuid, text, timestamptz)',
    'public.admin_unsuspend(uuid, text)',
    'public.admin_reset_onboarding(uuid, text)',
    'public.admin_replay_tutorial(uuid, text)',
    'public.admin_unlock_month(uuid, text, text)',
    'public.admin_remove_from_household(uuid, text)',
    'public.admin_clear_notifications(uuid, text)',
    'public.admin_list_flags()',
    'public.admin_flag_overrides(text)',
    'public.admin_set_flag(text, boolean, text)',
    'public.admin_create_flag(text, text, boolean)',
    'public.admin_set_override(uuid, text, boolean, text)',
    'public.admin_list_team()',
    'public.admin_add_admin(text, text, text)',
    'public.admin_set_role(uuid, text, text)',
    'public.admin_remove_admin(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

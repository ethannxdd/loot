-- =============================================================================================================
-- Migration 027 — Push & Apple Pay capture (Phase 6, batch B2)
-- Push subscriptions + per-kind preferences, the push delivery log, Apple Pay capture keys and their RPCs, and the
-- `push` / `apple_pay_capture` flags. Safe to run twice. Needs Migrations 025 + 026.
-- The scheduled jobs (pg_cron + pg_net + Vault) are NOT here — see supabase/sql/027_cron_setup.sql.
--
-- Deviations from the draft:
--   * notifications.kind: any existing CHECK constraint on it is replaced with one that includes the Phase 6 kinds
--     (the earlier migrations aren't in the repo, so the constraint name is looked up rather than assumed).
--   * notifications gets a `push_delivery_id` lookup index and an index for the dispatcher's "not pushed yet" scan.
--   * capture_keys stores `last_used_at` plus a `last_hashes` ring (the dedupe itself is spend_entries.external_hash).
--   * my_push_summary() lets Settings show which of your devices are subscribed without reading endpoints.
-- =============================================================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------------------
-- Preferences + push bookkeeping on existing tables
-- ---------------------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}';

alter table public.notifications
  add column if not exists pushed_at timestamptz;

create index if not exists notifications_unpushed on public.notifications (created_at) where pushed_at is null;

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.notifications'::regclass and con.contype = 'c' and att.attname = 'kind'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notifications add constraint notifications_kind_check check (kind in (
  'upcoming_debit', 'tax_deadline', 'subscription_anomaly', 'spending_anomaly', 'goal_milestone',
  'monthly_close_ready', 'briefing_ready', 'score_change', 'household_invite', 'system',
  'payday', 'debit_orders', 'pace', 'budget_low', 'wishlist_ready', 'renewal', 'price_change',
  'stokvel', 'split', 'challenge', 'announcement', 'feedback_reply'
));

-- ---------------------------------------------------------------------------------------------------------
-- Push subscriptions (one row per device/browser)
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  endpoint        text        not null unique check (endpoint ~ '^https://'),
  p256dh          text        not null,
  auth            text        not null,
  platform        text        not null check (platform in ('browser', 'pwa', 'ios', 'android')),
  user_agent      text        check (char_length(user_agent) <= 400),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   int         not null default 0
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage their push subscriptions" on public.push_subscriptions;
create policy "Users manage their push subscriptions" on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
-- NOT suspension-restricted: a suspended person must still be able to turn push off.

-- ---------------------------------------------------------------------------------------------------------
-- Delivery log (analytics + click tracking). No client access — RPC / service role only.
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.push_deliveries (
  id              bigint      generated always as identity primary key,
  user_id         uuid        not null references auth.users on delete cascade,
  notification_id uuid        references public.notifications on delete set null,
  announcement_id uuid,                                         -- FK added in 032
  kind            text        not null,
  platform        text,
  status          text        not null check (status in ('sent', 'failed', 'expired')),
  sent_at         timestamptz not null default now(),
  clicked_at      timestamptz
);
create index if not exists push_deliveries_user_day on public.push_deliveries (user_id, sent_at desc);
create index if not exists push_deliveries_sent on public.push_deliveries (sent_at desc);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Apple Pay capture keys — one active key per user; only the SHA-256 of the key is stored.
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.capture_keys (
  user_id      uuid        primary key references auth.users on delete cascade,
  key_hash     text        not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  uses_day     date,
  uses_today   int         not null default 0,
  total_uses   int         not null default 0
);
alter table public.capture_keys enable row level security;
revoke all on public.capture_keys from anon, authenticated;

create or replace function public.create_capture_key()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare k text := 'loot_cap_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.is_suspended() then raise exception 'account suspended'; end if;
  insert into public.capture_keys (user_id, key_hash) values (auth.uid(), encode(extensions.digest(k, 'sha256'), 'hex'))
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now(),
    last_used_at = null, uses_day = null, uses_today = 0, total_uses = 0;
  return k;                                                     -- shown once, never stored
end $$;

create or replace function public.revoke_capture_key()
returns void language sql security definer set search_path = public as $$
  delete from public.capture_keys where user_id = auth.uid();
$$;

create or replace function public.my_capture_key_status()
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('active', true, 'created_at', created_at, 'last_used_at', last_used_at, 'total_uses', total_uses)
       from public.capture_keys where user_id = auth.uid()),
    jsonb_build_object('active', false));
$$;

-- Called by log-spend (service role) for each capture: checks the key, enforces 200 a day (SAST), counts the use.
-- Returns the user id, or raises 'invalid key' / 'daily limit'.
create or replace function public.use_capture_key(p_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Africa/Johannesburg')::date;
  r public.capture_keys;
begin
  select * into r from public.capture_keys where key_hash = p_hash for update;
  if not found then raise exception 'invalid key'; end if;
  if r.uses_day = today and r.uses_today >= 200 then raise exception 'daily limit'; end if;
  update public.capture_keys set
    uses_day = today,
    uses_today = case when r.uses_day = today then r.uses_today + 1 else 1 end,
    total_uses = r.total_uses + 1,
    last_used_at = now()
  where user_id = r.user_id;
  return r.user_id;
end $$;

create or replace function public.mark_push_clicked(delivery_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.push_deliveries set clicked_at = coalesce(clicked_at, now())
  where id = delivery_id and user_id = auth.uid();
$$;

-- Settings → Notifications: how many devices are subscribed, by platform (no endpoints or keys).
create or replace function public.my_push_summary()
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'created_at', created_at, 'last_success_at', last_success_at)
                  order by created_at), '[]'::jsonb)
  from public.push_subscriptions where user_id = auth.uid();
$$;

-- push-dispatch (service role): count a failed send against a subscription.
create or replace function public.increment_push_failure(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions set failure_count = failure_count + 1 where id = p_id;
$$;
revoke all on function public.increment_push_failure(uuid) from public, anon, authenticated;

revoke all on function public.create_capture_key(), public.revoke_capture_key(), public.my_capture_key_status(),
  public.mark_push_clicked(bigint), public.my_push_summary() from public, anon;
grant execute on function public.create_capture_key(), public.revoke_capture_key(), public.my_capture_key_status(),
  public.mark_push_clicked(bigint), public.my_push_summary() to authenticated;
revoke all on function public.use_capture_key(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Flags (off for everyone)
-- ---------------------------------------------------------------------------------------------------------
insert into public.feature_flags (key, description) values
  ('push', 'Phase 6 B2 — push notifications (settings + server sends)'),
  ('apple_pay_capture', 'Phase 6 B2 — log Apple Pay spends automatically via iOS Shortcuts')
on conflict (key) do nothing;

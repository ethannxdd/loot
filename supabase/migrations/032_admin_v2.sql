-- =============================================================================================================
-- Migration 032 — Admin portal v2 (Phase 6, batch B7)
-- Announcements (+ receipts and delivery), feedback & support inbox, the content manager functions, analytics, and
-- extended Overview / User page data. Follows Migration 025's patterns: every admin_* function starts with
-- admin_require(min_role) (role + aal2), every write is logged with admin_log, reasons where 025 requires them.
-- Admin privacy (Rule 26): counts only — no money fields leave these functions. Safe to run twice. Needs 025–031.
--
-- Deviations from the draft:
--   * notifications.announcement_id links bell/push rows to an announcement (push-dispatch reports push stats).
--   * Delivery is one service-role function, materialise_due_announcements(), which push-dispatch calls each run.
--   * admin_overview_stats / admin_user_detail keep their 025 bodies (renamed *_v1 once) and are wrapped, so their
--     existing outputs are untouched and the new fields are added on top.
--   * admin_send_test_push queues a 'system' notification that push-dispatch delivers within 5 minutes, instead of
--     a new admin-actions edge action (no extra deploy; same audit + role rules).
--   * Feedback limits: 10 new threads a day, 30 replies a day per person; context limited to 2 kB.
-- =============================================================================================================

-- ---------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.announcements (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null check (char_length(title) between 1 and 60),
  body            text        not null check (char_length(body) between 1 and 240),
  link            text        check (link is null or (link ~ '^/[A-Za-z0-9/_?=&.-]*$' and char_length(link) <= 200)),
  style           text        not null default 'info' check (style in ('info', 'good', 'heads_up')),
  channels        text[]      not null default '{banner}' check (channels <@ array['banner', 'bell', 'push'] and cardinality(channels) > 0),
  audience        jsonb       not null default '{"all": true}',
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text        not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  recipient_count int,
  created_by      uuid        references auth.users on delete set null,
  sent_by         uuid        references auth.users on delete set null,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
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
create index if not exists announcement_receipts_user on public.announcement_receipts (user_id);

alter table public.notifications add column if not exists announcement_id uuid;
alter table public.notifications drop constraint if exists notifications_announcement_fk;
alter table public.notifications add constraint notifications_announcement_fk foreign key (announcement_id) references public.announcements on delete set null;
alter table public.push_deliveries drop constraint if exists push_deliveries_announcement_fk;
alter table public.push_deliveries add constraint push_deliveries_announcement_fk foreign key (announcement_id) references public.announcements on delete set null;

create table if not exists public.feedback (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users on delete cascade,
  kind              text        not null check (kind in ('problem', 'idea', 'question')),
  message           text        not null check (char_length(message) between 1 and 2000),
  context           jsonb       not null default '{}' check (pg_column_size(context) <= 2048),
  status            text        not null default 'new' check (status in ('new', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  priority          text        not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to       uuid        references auth.users on delete set null,
  unread_by_user    boolean     not null default false,
  first_response_at timestamptz,
  resolved_at       timestamptz,
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index if not exists feedback_status on public.feedback (status, last_activity_at desc);
create index if not exists feedback_user on public.feedback (user_id, created_at desc);

create table if not exists public.feedback_messages (
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null references public.feedback on delete cascade,
  sender      text        not null check (sender in ('user', 'admin')),
  admin_id    uuid        references auth.users on delete set null,
  body        text        not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists feedback_messages_thread on public.feedback_messages (feedback_id, created_at);

create table if not exists public.feedback_notes (
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null references public.feedback on delete cascade,
  admin_id    uuid        references auth.users on delete set null,
  body        text        not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create table if not exists public.saved_replies (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null check (char_length(title) between 1 and 80),
  body       text        not null check (char_length(body) between 1 and 2000),
  created_by uuid        references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['announcements','announcement_receipts','feedback','feedback_messages','feedback_notes','saved_replies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements for each row execute function public.loot_set_updated_at();

insert into public.feature_flags (key, description) values
  ('feedback', 'Phase 6 B7 — in-app feedback & support messages'),
  ('announcements_banner', 'Phase 6 B7 — announcement banner on Summary')
on conflict (key) do nothing;
-- Public (readable before sign-in): shows the Phase 6 tiles on the landing page once everything is rolled out.
insert into public.feature_flags (key, description, is_public) values
  ('phase6_landing', 'Phase 6 B8 — show Safe to spend, Stokvels, Wishlist and Tools on the landing page', true)
on conflict (key) do nothing;

-- Phase 6 flag descriptions name their batch (Admin → Feature flags).
update public.feature_flags set description = d.description from (values
  ('live_cycle', 'Phase 6 B1 — payday cycles, Safe to spend, spend log and Budgets'),
  ('push', 'Phase 6 B2 — push notifications (settings + server sends)'),
  ('apple_pay_capture', 'Phase 6 B2 — log Apple Pay spends automatically via iOS Shortcuts'),
  ('stokvels', 'Phase 6 B3 — stokvel tracking'),
  ('splits', 'Phase 6 B3 — splits & IOUs'),
  ('wishlist', 'Phase 6 B4 — wishlist with cooling-off'),
  ('tools', 'Phase 6 B4 — tools hub: calculators and seasonal planners'),
  ('renewals', 'Phase 6 B5 — renewals & price changes'),
  ('challenges', 'Phase 6 B5 — savings challenges'),
  ('future_you', 'Phase 6 B6 — TFSA, retirement and two-pot')
) as d(key, description) where feature_flags.key = d.key;

-- ---------------------------------------------------------------------------------------------------------
-- Audiences (counts only; no money)
-- {"all": true} or any AND-combination of: platforms [browser|pwa|ios|android], flag "<key>", onboarded true|false,
-- inactive_days N, signed_up_from/signed_up_to 'YYYY-MM-DD', user_id "<uuid>".
-- ---------------------------------------------------------------------------------------------------------
drop function if exists public.announcement_audience(jsonb);
create or replace function public.announcement_audience(p_aud jsonb) returns setof uuid
language sql stable security definer set search_path = public as $$
  select u.id from auth.users u
  left join public.profiles p on p.id = u.id
  where
    (p_aud ->> 'user_id' is null or u.id = (p_aud ->> 'user_id')::uuid)
    and (p_aud -> 'platforms' is null or jsonb_array_length(p_aud -> 'platforms') = 0 or exists (
      select 1 from (select distinct on (a.user_id) a.platform from public.app_activity a where a.user_id = u.id order by a.user_id, a.day desc) lp
      where lp.platform in (select jsonb_array_elements_text(p_aud -> 'platforms'))))
    and (p_aud ->> 'flag' is null or exists (
      select 1 from public.feature_flags f left join public.user_feature_overrides o on o.flag_key = f.key and o.user_id = u.id
      where f.key = p_aud ->> 'flag' and coalesce(o.enabled, f.enabled_globally)))
    and (p_aud ->> 'onboarded' is null or (p.onboarded_at is not null) = (p_aud ->> 'onboarded')::boolean)
    and (p_aud ->> 'inactive_days' is null or not exists (
      select 1 from public.app_activity a where a.user_id = u.id
        and a.day > (now() at time zone 'Africa/Johannesburg')::date - (p_aud ->> 'inactive_days')::int))
    and (p_aud ->> 'signed_up_from' is null or u.created_at >= (p_aud ->> 'signed_up_from')::date)
    and (p_aud ->> 'signed_up_to' is null or u.created_at < (p_aud ->> 'signed_up_to')::date + 1)
$$;
revoke all on function public.announcement_audience(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Delivery (service role, called by push-dispatch every 5 minutes)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.materialise_due_announcements() returns int
language plpgsql security definer set search_path = public as $$
declare a record; n int := 0; cnt int;
begin
  for a in select * from public.announcements where status = 'scheduled' and coalesce(starts_at, now()) <= now() for update skip locked loop
    insert into public.announcement_receipts (announcement_id, user_id)
    select a.id, x from public.announcement_audience(a.audience) x
    on conflict do nothing;
    get diagnostics cnt = row_count;
    if 'bell' = any (a.channels) or 'push' = any (a.channels) then
      insert into public.notifications (user_id, kind, title, body, link, dedupe_key, announcement_id, pushed_at)
      select r.user_id, 'announcement', a.title, a.body, a.link, 'announcement:' || a.id, a.id,
             case when 'push' = any (a.channels) then null else now() end
      from public.announcement_receipts r where r.announcement_id = a.id
      on conflict do nothing;
    end if;
    update public.announcements set status = 'live', recipient_count = cnt where id = a.id;
    n := n + 1;
  end loop;
  update public.announcements set status = 'ended' where status = 'live' and ends_at is not null and ends_at <= now();
  return n;
end $$;
revoke all on function public.materialise_due_announcements() from public, anon, authenticated;
grant execute on function public.materialise_due_announcements() to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- App side (any signed-in user)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.my_announcements() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'link', a.link, 'style', a.style)
                  order by a.sent_at desc nulls last), '[]'::jsonb)
  from public.announcements a
  join public.announcement_receipts r on r.announcement_id = a.id and r.user_id = auth.uid()
  where a.status = 'live' and 'banner' = any (a.channels) and r.dismissed_at is null
    and (a.ends_at is null or a.ends_at > now());
$$;

create or replace function public.mark_announcement(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.announcement_receipts set
    seen_at = case when p_action in ('seen', 'clicked', 'dismissed') then coalesce(seen_at, now()) else seen_at end,
    clicked_at = case when p_action = 'clicked' then coalesce(clicked_at, now()) else clicked_at end,
    dismissed_at = case when p_action = 'dismissed' then coalesce(dismissed_at, now()) else dismissed_at end,
    push_clicked_at = case when p_action = 'push_clicked' then coalesce(push_clicked_at, now()) else push_clicked_at end
  where announcement_id = p_id and user_id = auth.uid();
end $$;

-- Works while suspended: people must always be able to reach support.
create or replace function public.send_feedback(p_kind text, p_message text, p_context jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_today int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('problem', 'idea', 'question') then raise exception 'unknown kind'; end if;
  if p_message is null or length(btrim(p_message)) = 0 then raise exception 'Write a message first.'; end if;
  select count(*) into v_today from public.feedback where user_id = auth.uid() and created_at > now() - interval '1 day';
  if v_today >= 10 then raise exception 'That''s 10 messages today. Loot support will get back to you.'; end if;
  insert into public.feedback (user_id, kind, message, context)
  values (auth.uid(), p_kind, left(btrim(p_message), 2000), coalesce(p_context, '{}'::jsonb))
  returning id into v_id;
  insert into public.feedback_messages (feedback_id, sender, body) values (v_id, 'user', left(btrim(p_message), 2000));
  return v_id;
end $$;

create or replace function public.my_feedback() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'kind', f.kind, 'message', f.message, 'status', f.status, 'unread', f.unread_by_user,
    'created_at', f.created_at, 'last_activity_at', f.last_activity_at) order by f.last_activity_at desc), '[]'::jsonb)
  from public.feedback f where f.user_id = auth.uid();
$$;

create or replace function public.my_feedback_thread(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not exists (select 1 from public.feedback where id = p_id and user_id = auth.uid()) then raise exception 'not found'; end if;
  update public.feedback set unread_by_user = false where id = p_id and user_id = auth.uid();
  select jsonb_build_object(
    'id', f.id, 'kind', f.kind, 'status', f.status, 'created_at', f.created_at,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
                          from public.feedback_messages m where m.feedback_id = f.id), '[]'::jsonb))
  into r from public.feedback f where f.id = p_id;
  return r;
end $$;

create or replace function public.reply_feedback(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_today int;
begin
  if not exists (select 1 from public.feedback where id = p_id and user_id = auth.uid()) then raise exception 'not found'; end if;
  if p_body is null or length(btrim(p_body)) = 0 then raise exception 'Write a message first.'; end if;
  select count(*) into v_today from public.feedback_messages m join public.feedback f on f.id = m.feedback_id
  where f.user_id = auth.uid() and m.sender = 'user' and m.created_at > now() - interval '1 day';
  if v_today >= 30 then raise exception 'That''s enough messages for today.'; end if;
  insert into public.feedback_messages (feedback_id, sender, body) values (p_id, 'user', left(btrim(p_body), 2000));
  update public.feedback set last_activity_at = now(),
    status = case when status in ('waiting_on_user', 'resolved', 'closed') then 'in_progress' else status end
  where id = p_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Feedback inbox (admin)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.admin_list_feedback(
  p_status text default null, p_kind text default null, p_platform text default null, p_assigned text default null,
  p_search text default null, p_limit int default 50, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_search text := nullif(btrim(coalesce(p_search, '')), ''); result jsonb;
begin
  perform public.admin_require('viewer');
  with filtered as (
    select f.*, u.email from public.feedback f join auth.users u on u.id = f.user_id
    where (p_status is null or f.status = p_status)
      and (p_kind is null or f.kind = p_kind)
      and (p_platform is null or f.context ->> 'platform' = p_platform)
      and (p_assigned is null or (p_assigned = 'me' and f.assigned_to = auth.uid()) or (p_assigned = 'none' and f.assigned_to is null))
      and (v_search is null or f.message ilike '%' || v_search || '%' or u.email ilike '%' || v_search || '%')
  )
  select jsonb_build_object(
    'counts', (select jsonb_object_agg(s, (select count(*) from public.feedback x where x.status = s))
               from unnest(array['new', 'in_progress', 'waiting_on_user', 'resolved', 'closed']) s),
    'unanswered', (select count(*) from public.feedback x where x.first_response_at is null and x.status in ('new', 'in_progress')),
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'first_line', left(split_part(f.message, E'\n', 1), 140), 'email', f.email, 'user_id', f.user_id,
        'status', f.status, 'priority', f.priority, 'created_at', f.created_at, 'last_activity_at', f.last_activity_at,
        'assigned_to_email', (select email from auth.users a where a.id = f.assigned_to),
        'platform', f.context ->> 'platform',
        'awaiting_admin', (select m.sender from public.feedback_messages m where m.feedback_id = f.id order by m.created_at desc limit 1) = 'user'
      ) order by f.last_activity_at desc)
      from (select * from filtered order by last_activity_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) f), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.admin_feedback_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.admin_require('viewer');
  select jsonb_build_object(
    'id', f.id, 'kind', f.kind, 'message', f.message, 'context', f.context, 'status', f.status, 'priority', f.priority,
    'assigned_to', f.assigned_to, 'created_at', f.created_at, 'first_response_at', f.first_response_at, 'resolved_at', f.resolved_at,
    'user', jsonb_build_object('id', u.id, 'email', u.email, 'display_name', p.display_name, 'created_at', u.created_at,
      'suspended', exists (select 1 from public.account_status s where s.user_id = u.id and s.status = 'suspended' and (s.suspended_until is null or s.suspended_until > now()))),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'created_at', m.created_at,
        'admin_email', (select email from auth.users a where a.id = m.admin_id)) order by m.created_at)
      from public.feedback_messages m where m.feedback_id = f.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at,
        'admin_email', (select email from auth.users a where a.id = n.admin_id)) order by n.created_at)
      from public.feedback_notes n where n.feedback_id = f.id), '[]'::jsonb),
    'other_threads', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'status', o.status, 'created_at', o.created_at) order by o.created_at desc)
      from public.feedback o where o.user_id = f.user_id and o.id <> f.id), '[]'::jsonb)
  ) into r
  from public.feedback f join auth.users u on u.id = f.user_id left join public.profiles p on p.id = u.id
  where f.id = p_id;
  if r is null then raise exception 'That thread no longer exists.' using errcode = 'P0002'; end if;
  return r;
end $$;

create or replace function public.admin_reply_feedback(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  perform public.admin_require('support');
  if p_body is null or length(btrim(p_body)) = 0 then raise exception 'Write a reply first.'; end if;
  select user_id into v_user from public.feedback where id = p_id;
  if v_user is null then raise exception 'That thread no longer exists.' using errcode = 'P0002'; end if;
  insert into public.feedback_messages (feedback_id, sender, admin_id, body) values (p_id, 'admin', auth.uid(), left(btrim(p_body), 2000));
  update public.feedback set
    first_response_at = coalesce(first_response_at, now()),
    unread_by_user = true,
    last_activity_at = now(),
    status = case when status = 'new' then 'waiting_on_user' else status end
  where id = p_id;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (v_user, 'feedback_reply', 'Loot support replied', 'Loot support replied to your message.', '/settings?support=' || p_id,
          'feedback_reply:' || p_id || ':' || extract(epoch from now())::bigint)
  on conflict do nothing;
  perform public.admin_log('feedback_reply', v_user, null, jsonb_build_object('feedback_id', p_id));
end $$;

create or replace function public.admin_add_feedback_note(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  if not exists (select 1 from public.feedback where id = p_id) then raise exception 'That thread no longer exists.' using errcode = 'P0002'; end if;
  insert into public.feedback_notes (feedback_id, admin_id, body) values (p_id, auth.uid(), left(btrim(p_body), 2000));
  perform public.admin_log('feedback_note', (select user_id from public.feedback where id = p_id), null, jsonb_build_object('feedback_id', p_id));
end $$;

create or replace function public.admin_update_feedback(p_id uuid, p_status text default null, p_priority text default null, p_assigned_to uuid default null, p_unassign boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  if p_assigned_to is not null and not exists (select 1 from public.admin_users where user_id = p_assigned_to) then
    raise exception 'Assign to someone on the admin team.';
  end if;
  update public.feedback set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    assigned_to = case when p_unassign then null else coalesce(p_assigned_to, assigned_to) end,
    resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) when p_status is not null then null else resolved_at end,
    last_activity_at = now()
  where id = p_id;
  if not found then raise exception 'That thread no longer exists.' using errcode = 'P0002'; end if;
  perform public.admin_log('feedback_update', (select user_id from public.feedback where id = p_id), null,
    jsonb_strip_nulls(jsonb_build_object('feedback_id', p_id, 'status', p_status, 'priority', p_priority, 'assigned_to', p_assigned_to, 'unassign', nullif(p_unassign, false))));
end $$;

create or replace function public.admin_list_saved_replies() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body) order by title) from public.saved_replies), '[]'::jsonb);
end $$;

create or replace function public.admin_save_reply(p_id uuid, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform public.admin_require('owner');
  if p_id is null then
    insert into public.saved_replies (title, body, created_by) values (btrim(p_title), btrim(p_body), auth.uid()) returning id into v;
  else
    update public.saved_replies set title = btrim(p_title), body = btrim(p_body), updated_at = now() where id = p_id returning id into v;
  end if;
  perform public.admin_log('saved_reply_save', null, null, jsonb_build_object('id', v, 'title', p_title));
  return v;
end $$;

create or replace function public.admin_delete_reply(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('owner');
  delete from public.saved_replies where id = p_id;
  perform public.admin_log('saved_reply_delete', null, null, jsonb_build_object('id', p_id));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Content manager
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.admin_content_min_role(p_key text) returns text
language sql immutable as $$
  select case when p_key like 'tax_tables:%' or p_key in ('tfsa_limits', 'two_pot', 'transfer_duty', 'bond_costs', 'assistant_daily_cap', 'retirement_real_return_pct')
              then 'owner' else 'support' end
$$;

create or replace function public.admin_list_content() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return jsonb_build_object(
    'settings', coalesce((select jsonb_agg(jsonb_build_object(
        'key', s.key, 'value', s.value, 'draft', s.draft, 'published_at', s.published_at, 'updated_at', s.updated_at,
        'published_by_email', (select email from auth.users u where u.id = s.published_by),
        'min_role', public.admin_content_min_role(s.key)) order by s.key) from public.app_settings s), '[]'::jsonb),
    'price_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.effective_on desc) from public.price_events e), '[]'::jsonb));
end $$;

create or replace function public.admin_save_setting_draft(p_key text, p_draft jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require(public.admin_content_min_role(p_key));
  insert into public.app_settings (key, draft, updated_by) values (p_key, p_draft, auth.uid())
  on conflict (key) do update set draft = excluded.draft, updated_by = auth.uid(), updated_at = now();
  perform public.admin_log('content_draft', null, null, jsonb_build_object('key', p_key));
end $$;

create or replace function public.admin_publish_setting(p_key text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb;
begin
  perform public.admin_require(public.admin_content_min_role(p_key));
  perform public.admin_require_reason(p_reason);
  select value, draft into v_old, v_new from public.app_settings where key = p_key for update;
  if v_new is null then raise exception 'There is no draft to publish.'; end if;
  update public.app_settings set value = draft, draft = null, published_at = now(), published_by = auth.uid(), updated_at = now() where key = p_key;
  perform public.admin_log('content_publish', null, p_reason, jsonb_build_object('key', p_key, 'before', v_old, 'after', v_new));
end $$;

create or replace function public.admin_upsert_price_event(p_event jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := nullif(p_event ->> 'id', '')::uuid;
begin
  perform public.admin_require('support');
  if v is null then
    insert into public.price_events (kind, title, description, effective_on, category, change_pct, change_amount, change_unit, region, source_url, status, created_by, updated_by)
    values (p_event ->> 'kind', p_event ->> 'title', coalesce(p_event ->> 'description', ''), (p_event ->> 'effective_on')::date, p_event ->> 'category',
            nullif(p_event ->> 'change_pct', '')::numeric, nullif(p_event ->> 'change_amount', '')::numeric, nullif(p_event ->> 'change_unit', ''),
            coalesce(p_event ->> 'region', 'all'), nullif(p_event ->> 'source_url', ''), 'draft', auth.uid(), auth.uid())
    returning id into v;
  else
    update public.price_events set kind = p_event ->> 'kind', title = p_event ->> 'title', description = coalesce(p_event ->> 'description', ''),
      effective_on = (p_event ->> 'effective_on')::date, category = p_event ->> 'category',
      change_pct = nullif(p_event ->> 'change_pct', '')::numeric, change_amount = nullif(p_event ->> 'change_amount', '')::numeric,
      change_unit = nullif(p_event ->> 'change_unit', ''), region = coalesce(p_event ->> 'region', 'all'),
      source_url = nullif(p_event ->> 'source_url', ''), updated_by = auth.uid()
    where id = v;
  end if;
  perform public.admin_log('price_event_save', null, null, jsonb_build_object('id', v, 'title', p_event ->> 'title'));
  return v;
end $$;

create or replace function public.admin_set_price_event_status(p_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_reason(p_reason);
  update public.price_events set status = p_status, updated_by = auth.uid() where id = p_id;
  if not found then raise exception 'That price change no longer exists.' using errcode = 'P0002'; end if;
  perform public.admin_log('price_event_status', null, p_reason, jsonb_build_object('id', p_id, 'status', p_status));
end $$;

create or replace function public.admin_price_event_reach(p_category text) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return (select count(distinct user_id) from public.expenses where category = p_category and deleted_at is null);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Announcements (admin)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.admin_announcement_reach(p_audience jsonb) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return (select count(*) from public.announcement_audience(coalesce(p_audience, '{"all": true}'::jsonb)));
end $$;

create or replace function public.admin_save_announcement(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := nullif(p ->> 'id', '')::uuid;
        v_channels text[] := array(select jsonb_array_elements_text(coalesce(p -> 'channels', '["banner"]'::jsonb)));
begin
  perform public.admin_require('support');
  if v is null then
    insert into public.announcements (title, body, link, style, channels, audience, starts_at, ends_at, created_by)
    values (p ->> 'title', p ->> 'body', nullif(p ->> 'link', ''), coalesce(p ->> 'style', 'info'), v_channels,
            coalesce(p -> 'audience', '{"all": true}'::jsonb), nullif(p ->> 'starts_at', '')::timestamptz, nullif(p ->> 'ends_at', '')::timestamptz, auth.uid())
    returning id into v;
  else
    update public.announcements set title = p ->> 'title', body = p ->> 'body', link = nullif(p ->> 'link', ''), style = coalesce(p ->> 'style', 'info'),
      channels = v_channels, audience = coalesce(p -> 'audience', '{"all": true}'::jsonb),
      starts_at = nullif(p ->> 'starts_at', '')::timestamptz, ends_at = nullif(p ->> 'ends_at', '')::timestamptz
    where id = v and status = 'draft';
    if not found then raise exception 'Only drafts can be edited.'; end if;
  end if;
  perform public.admin_log('announcement_save', nullif(p #>> '{audience,user_id}', '')::uuid, null, jsonb_build_object('id', v, 'title', p ->> 'title'));
  return v;
end $$;

-- Support can send to fewer than 50 people (or one person); everyone / 50+ needs an Owner.
create or replace function public.admin_send_announcement(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.announcements; v_reach int; v_role text;
begin
  perform public.admin_require('support');
  perform public.admin_require_reason(p_reason);
  select * into a from public.announcements where id = p_id for update;
  if a.id is null then raise exception 'That announcement no longer exists.' using errcode = 'P0002'; end if;
  if a.status <> 'draft' then raise exception 'It has already been sent.'; end if;
  select count(*) into v_reach from public.announcement_audience(a.audience);
  select role into v_role from public.admin_users where user_id = auth.uid();
  if (coalesce((a.audience ->> 'all')::boolean, false) or v_reach >= 50) and v_role <> 'owner' then
    raise exception 'Only an Owner can send to everyone or to 50 or more people.' using errcode = '42501';
  end if;
  update public.announcements set status = 'scheduled', starts_at = coalesce(starts_at, now()), sent_by = auth.uid(), sent_at = now() where id = p_id;
  perform public.admin_log('announcement_send', nullif(a.audience ->> 'user_id', '')::uuid, p_reason,
    jsonb_build_object('id', p_id, 'title', a.title, 'reach', v_reach, 'channels', a.channels));
  return jsonb_build_object('reach', v_reach);
end $$;

create or replace function public.admin_cancel_announcement(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_reason(p_reason);
  update public.announcements set status = case when status in ('live', 'scheduled') then 'cancelled' else status end where id = p_id;
  perform public.admin_log('announcement_cancel', null, p_reason, jsonb_build_object('id', p_id));
end $$;

create or replace function public.admin_list_announcements() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'body', a.body, 'link', a.link, 'style', a.style, 'channels', a.channels, 'audience', a.audience,
      'starts_at', a.starts_at, 'ends_at', a.ends_at, 'status', a.status, 'recipient_count', a.recipient_count, 'sent_at', a.sent_at,
      'created_at', a.created_at,
      'clicked', (select count(*) from public.announcement_receipts r where r.announcement_id = a.id and (r.clicked_at is not null or r.push_clicked_at is not null))
    ) order by a.created_at desc) from public.announcements a), '[]'::jsonb);
end $$;

create or replace function public.admin_announcement_stats(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_require('viewer');
  return jsonb_build_object(
    'recipients', (select count(*) from public.announcement_receipts where announcement_id = p_id),
    'seen', (select count(*) from public.announcement_receipts where announcement_id = p_id and seen_at is not null),
    'clicked', (select count(*) from public.announcement_receipts where announcement_id = p_id and clicked_at is not null),
    'dismissed', (select count(*) from public.announcement_receipts where announcement_id = p_id and dismissed_at is not null),
    'pushed', (select count(distinct user_id) from public.push_deliveries where announcement_id = p_id and status = 'sent'),
    'push_clicked', (select count(distinct user_id) from public.push_deliveries where announcement_id = p_id and clicked_at is not null));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- User page actions
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.admin_clear_push(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  perform public.admin_require_reason(p_reason);
  delete from public.push_subscriptions where user_id = p_user;
  get diagnostics n = row_count;
  perform public.admin_log('clear_push', p_user, p_reason, jsonb_build_object('devices', n));
end $$;

create or replace function public.admin_revoke_capture_key(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  perform public.admin_require_reason(p_reason);
  delete from public.capture_keys where user_id = p_user;
  perform public.admin_log('revoke_capture_key', p_user, p_reason, '{}');
end $$;

create or replace function public.admin_reset_assistant_limit(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  perform public.admin_require_reason(p_reason);
  delete from public.assistant_usage where user_id = p_user and day = (now() at time zone 'Africa/Johannesburg')::date;
  perform public.admin_log('reset_assistant_limit', p_user, p_reason, '{}');
end $$;

create or replace function public.admin_send_test_push(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require('support');
  perform public.admin_require_target(p_user);
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, 'system', 'Test from Loot', 'If you can see this, push works on your device.', '/settings',
          'test_push:' || extract(epoch from now())::bigint);
  perform public.admin_log('test_push', p_user, null, '{}');
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Overview and User page — 025 outputs kept, new fields added
-- ---------------------------------------------------------------------------------------------------------
do $$ begin
  if to_regprocedure('public.admin_overview_stats_v1(integer)') is null and to_regprocedure('public.admin_overview_stats(integer)') is not null then
    alter function public.admin_overview_stats(int) rename to admin_overview_stats_v1;
  end if;
  if to_regprocedure('public.admin_user_detail_v1(uuid)') is null and to_regprocedure('public.admin_user_detail(uuid)') is not null then
    alter function public.admin_user_detail(uuid) rename to admin_user_detail_v1;
  end if;
end $$;
revoke all on function public.admin_overview_stats_v1(int), public.admin_user_detail_v1(uuid) from public, anon, authenticated;

create or replace function public.admin_overview_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  base jsonb;
  v_week date := (now() at time zone 'Africa/Johannesburg')::date - 6;
  v_wau int;
  v_stale int := 0;
begin
  perform public.admin_require('viewer');
  base := public.admin_overview_stats_v1(p_days);
  select count(distinct user_id) into v_wau from public.app_activity where day >= v_week;
  select count(*) into v_stale from public.app_settings s
  where (s.key = 'fuel_prices' and (s.value ->> 'effective')::date < current_date - 35)
     or (s.key = 'prime_rate' and (s.value ->> 'effective')::date < current_date - 120);
  return base || jsonb_build_object(
    'push_opt_in', jsonb_build_object('subscribed', (select count(distinct user_id) from public.push_subscriptions), 'active_7d', v_wau),
    'loggers_7d', (select count(distinct user_id) from public.spend_entries where created_at > now() - interval '7 days'),
    'phase6_attention', jsonb_build_object(
      'unanswered_feedback_48h', (select count(*) from public.feedback where first_response_at is null and status in ('new', 'in_progress') and created_at < now() - interval '48 hours'),
      'stale_content', v_stale,
      'push_failure_rate_24h', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where status <> 'sent') / count(*), 1) end
                                from public.push_deliveries where sent_at > now() - interval '24 hours'),
      'missing_tax_table', not exists (select 1 from public.app_settings where key = 'tax_tables:' || (
        case when extract(month from current_date) >= 3 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end
      ) || '/' || lpad(((case when extract(month from current_date) >= 3 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end + 1) % 100)::text, 2, '0') and value is not null)));
end $$;

create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare base jsonb;
begin
  perform public.admin_require('viewer');
  base := public.admin_user_detail_v1(p_user);
  return base
    || jsonb_build_object('usage', (base -> 'usage') || jsonb_build_object(
        'spend_entries', (select count(*) from public.spend_entries x where x.user_id = p_user and x.deleted_at is null),
        'stokvels', (select count(*) from public.stokvels x where x.user_id = p_user),
        'splits', (select count(*) from public.splits x where x.user_id = p_user and x.deleted_at is null),
        'wishlist', (select count(*) from public.wishlist_items x where x.user_id = p_user),
        'scenarios', (select count(*) from public.saved_scenarios x where x.user_id = p_user),
        'renewals', (select count(*) from public.renewals x where x.user_id = p_user),
        'challenges', (select count(*) from public.challenges x where x.user_id = p_user),
        'tfsa_contributions', (select count(*) from public.tfsa_contributions x where x.user_id = p_user),
        'assistant_today', coalesce((select questions from public.assistant_usage x where x.user_id = p_user and x.day = (now() at time zone 'Africa/Johannesburg')::date), 0)))
    || jsonb_build_object(
      'phase6', jsonb_build_object(
        'payday_set', (select payday_day is not null from public.profiles where id = p_user),
        'push_devices', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'created_at', created_at, 'last_success_at', last_success_at) order by created_at)
                                  from public.push_subscriptions where user_id = p_user), '[]'::jsonb),
        'capture_key', (select jsonb_build_object('active', true, 'created_at', created_at, 'last_used_at', last_used_at, 'total_uses', total_uses)
                        from public.capture_keys where user_id = p_user),
        'feedback', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'created_at', created_at) order by created_at desc)
                              from public.feedback where user_id = p_user), '[]'::jsonb)));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Analytics (counts only)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.admin_analytics_retention(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz constant text := 'Africa/Johannesburg'; v_today date := (now() at time zone tz)::date;
        v_days int := least(greatest(coalesce(nullif(p_days, 0), 90), 7), 180);
begin
  perform public.admin_require('viewer');
  -- Weekly sign-up cohorts × weeks 0–12: how many of each cohort were active in week k after signing up.
  return coalesce((
    with cohorts as (
      select u.id, date_trunc('week', (u.created_at at time zone tz))::date wk
      from auth.users u where (u.created_at at time zone tz)::date > v_today - v_days
    ),
    sizes as (select wk, count(*) size from cohorts group by wk),
    cells as (
      select c.wk, k, count(distinct a.user_id) active
      from cohorts c
      cross join generate_series(0, 12) k
      left join public.app_activity a on a.user_id = c.id and a.day >= c.wk + k * 7 and a.day < c.wk + (k + 1) * 7
      where c.wk + k * 7 <= v_today
      group by c.wk, k
    )
    select jsonb_agg(jsonb_build_object('cohort', s.wk, 'size', s.size,
      'weeks', (select jsonb_agg(jsonb_build_object('week', x.k, 'active', x.active) order by x.k) from cells x where x.wk = s.wk)) order by s.wk)
    from sizes s), '[]'::jsonb);
end $$;

create or replace function public.admin_analytics_engagement(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz constant text := 'Africa/Johannesburg'; v_today date := (now() at time zone tz)::date;
        v_days int := least(greatest(coalesce(nullif(p_days, 0), 90), 7), 180);
begin
  perform public.admin_require('viewer');
  return jsonb_build_object(
    'series', coalesce((select jsonb_agg(jsonb_build_object('day', d,
        'dau', (select count(*) from public.app_activity where day = d),
        'wau', (select count(distinct user_id) from public.app_activity where day > d - 7 and day <= d),
        'mau', (select count(distinct user_id) from public.app_activity where day > d - 30 and day <= d)) order by d)
      from generate_series(v_today - (v_days - 1), v_today, interval '1 day') g(x), lateral (select x::date d) y), '[]'::jsonb),
    'active_days', coalesce((select jsonb_agg(jsonb_build_object('days', days, 'users', n) order by days) from (
        select days, count(*) n from (select user_id, count(*) days from public.app_activity where day > v_today - v_days group by user_id) t group by days) z), '[]'::jsonb),
    'platform_days', (select jsonb_object_agg(platform, n) from (select platform, count(*) n from public.app_activity where day > v_today - v_days group by platform) p),
    'loggers_wau', jsonb_build_object(
      'loggers', (select count(distinct user_id) from public.spend_entries where created_at > now() - interval '7 days'),
      'wau', (select count(distinct user_id) from public.app_activity where day > v_today - 7)));
end $$;

create or replace function public.admin_analytics_features(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(nullif(p_days, 0), 365), 7), 365));
        v_active int;
begin
  perform public.admin_require('viewer');
  select count(distinct user_id) into v_active from public.app_activity where day >= (v_since at time zone 'Africa/Johannesburg')::date;
  return jsonb_build_object('active', v_active, 'features', jsonb_build_array(
    jsonb_build_object('key', 'live_cycle', 'label', 'Spend log', 'users', (select count(distinct user_id) from public.spend_entries where created_at >= v_since)),
    jsonb_build_object('key', 'push', 'label', 'Push', 'users', (select count(distinct user_id) from public.push_subscriptions)),
    jsonb_build_object('key', 'apple_pay_capture', 'label', 'Apple Pay capture', 'users', (select count(distinct user_id) from public.spend_entries where source = 'apple_pay' and created_at >= v_since)),
    jsonb_build_object('key', 'stokvels', 'label', 'Stokvels', 'users', (select count(distinct user_id) from public.stokvels where created_at >= v_since or updated_at >= v_since)),
    jsonb_build_object('key', 'splits', 'label', 'Splits', 'users', (select count(distinct user_id) from public.splits where created_at >= v_since)),
    jsonb_build_object('key', 'wishlist', 'label', 'Wishlist', 'users', (select count(distinct user_id) from public.wishlist_items where created_at >= v_since)),
    jsonb_build_object('key', 'tools', 'label', 'Tools (saved scenarios)', 'users', (select count(distinct user_id) from public.saved_scenarios where updated_at >= v_since)),
    jsonb_build_object('key', 'renewals', 'label', 'Renewals', 'users', (select count(distinct user_id) from public.renewals where created_at >= v_since)),
    jsonb_build_object('key', 'challenges', 'label', 'Challenges', 'users', (select count(distinct user_id) from public.challenges where created_at >= v_since)),
    jsonb_build_object('key', 'future_you', 'label', 'TFSA tracker', 'users', (select count(distinct user_id) from public.tfsa_contributions where created_at >= v_since)),
    jsonb_build_object('key', 'assistant', 'label', 'Ask Loot', 'users', (select count(distinct user_id) from public.assistant_usage where day >= (v_since at time zone 'Africa/Johannesburg')::date)),
    jsonb_build_object('key', 'feedback', 'label', 'Feedback', 'users', (select count(distinct user_id) from public.feedback where created_at >= v_since))
  ), 'flags', (select jsonb_object_agg(key, jsonb_build_object('global', enabled_globally,
      'overrides_on', (select count(*) from public.user_feature_overrides o where o.flag_key = f.key and o.enabled))) from public.feature_flags f));
end $$;

create or replace function public.admin_analytics_notifications(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(nullif(p_days, 0), 365), 1), 365));
begin
  perform public.admin_require('viewer');
  return jsonb_build_object(
    'subscriptions', (select coalesce(jsonb_object_agg(platform, n), '{}'::jsonb) from (select platform, count(*) n from public.push_subscriptions group by platform) p),
    'subscribed_users', (select count(distinct user_id) from public.push_subscriptions),
    'active_30d', (select count(distinct user_id) from public.app_activity where day > (now() at time zone 'Africa/Johannesburg')::date - 30),
    'by_kind', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'sent', sent, 'failed', failed, 'clicked', clicked) order by sent desc) from (
        select kind, count(*) filter (where status = 'sent') sent, count(*) filter (where status <> 'sent') failed, count(*) filter (where clicked_at is not null) clicked
        from public.push_deliveries where sent_at >= v_since group by kind) k), '[]'::jsonb),
    'opt_outs', coalesce((select jsonb_object_agg(k, n) from (
        select k, count(*) n from public.profiles p, jsonb_each(p.notification_prefs) e(k, v) where v = 'false'::jsonb group by k) o), '{}'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'status', a.status, 'sent_at', a.sent_at,
        'recipients', (select count(*) from public.announcement_receipts r where r.announcement_id = a.id),
        'seen', (select count(*) from public.announcement_receipts r where r.announcement_id = a.id and r.seen_at is not null),
        'clicked', (select count(*) from public.announcement_receipts r where r.announcement_id = a.id and r.clicked_at is not null)) order by a.sent_at desc)
      from public.announcements a where a.sent_at >= v_since), '[]'::jsonb));
end $$;

create or replace function public.admin_analytics_support(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(nullif(p_days, 0), 365), 1), 365));
begin
  perform public.admin_require('viewer');
  return jsonb_build_object(
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('week', wk, 'problem', p, 'idea', i, 'question', q) order by wk) from (
        select date_trunc('week', created_at)::date wk, count(*) filter (where kind = 'problem') p, count(*) filter (where kind = 'idea') i, count(*) filter (where kind = 'question') q
        from public.feedback where created_at >= v_since group by 1) w), '[]'::jsonb),
    'open_now', (select count(*) from public.feedback where status in ('new', 'in_progress', 'waiting_on_user')),
    'median_first_response_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from first_response_at - created_at) / 3600))::numeric, 1)
                                    from public.feedback where first_response_at is not null and created_at >= v_since),
    'median_resolve_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from resolved_at - created_at) / 3600))::numeric, 1)
                             from public.feedback where resolved_at is not null and created_at >= v_since),
    'top_pages', coalesce((select jsonb_agg(jsonb_build_object('route', route, 'count', n) order by n desc) from (
        select context ->> 'route' route, count(*) n from public.feedback where created_at >= v_since and kind = 'problem' and context ->> 'route' is not null
        group by 1 order by 2 desc limit 8) t), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Grants (same pattern as 025)
-- ---------------------------------------------------------------------------------------------------------
revoke all on function public.admin_content_min_role(text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_announcements()', 'public.mark_announcement(uuid, text)',
    'public.send_feedback(text, text, jsonb)', 'public.my_feedback()', 'public.my_feedback_thread(uuid)', 'public.reply_feedback(uuid, text)',
    'public.admin_list_feedback(text, text, text, text, text, int, int)', 'public.admin_feedback_detail(uuid)',
    'public.admin_reply_feedback(uuid, text)', 'public.admin_add_feedback_note(uuid, text)',
    'public.admin_update_feedback(uuid, text, text, uuid, boolean)',
    'public.admin_list_saved_replies()', 'public.admin_save_reply(uuid, text, text)', 'public.admin_delete_reply(uuid)',
    'public.admin_list_content()', 'public.admin_save_setting_draft(text, jsonb)', 'public.admin_publish_setting(text, text)',
    'public.admin_upsert_price_event(jsonb)', 'public.admin_set_price_event_status(uuid, text, text)', 'public.admin_price_event_reach(text)',
    'public.admin_announcement_reach(jsonb)', 'public.admin_save_announcement(jsonb)', 'public.admin_send_announcement(uuid, text)',
    'public.admin_cancel_announcement(uuid, text)', 'public.admin_list_announcements()', 'public.admin_announcement_stats(uuid)',
    'public.admin_clear_push(uuid, text)', 'public.admin_revoke_capture_key(uuid, text)', 'public.admin_reset_assistant_limit(uuid, text)',
    'public.admin_send_test_push(uuid)',
    'public.admin_overview_stats(int)', 'public.admin_user_detail(uuid)',
    'public.admin_analytics_retention(int)', 'public.admin_analytics_engagement(int)', 'public.admin_analytics_features(int)',
    'public.admin_analytics_notifications(int)', 'public.admin_analytics_support(int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- =============================================================================================================
-- Migration 029 — Decide (Phase 6, batch B4)
-- Wishlist with cooling-off (Rule 22) and saved tool scenarios (inputs only — outputs are always recomputed), plus
-- the `wishlist` / `tools` flags. Safe to run twice.
--
-- Deviations from the draft:
--   * ready_at must be after added_at; name/url/verdict text length limits; url must be http(s).
--   * saved_scenarios.inputs is limited to 20 kB so a scenario can't be used as file storage.
--   * updated_at triggers via public.loot_set_updated_at() (Migration 026).
-- =============================================================================================================

create table if not exists public.wishlist_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users on delete cascade,
  name              text        not null check (char_length(name) between 1 and 80),
  price             numeric     not null check (price > 0 and price <= 100000000),
  url               text        check (url is null or (char_length(url) <= 500 and url ~ '^https?://')),
  category          text,
  cool_off_days     int         not null check (cool_off_days in (2, 7, 30)),
  added_at          timestamptz not null default now(),
  ready_at          timestamptz not null,
  status            text        not null default 'waiting' check (status in ('waiting', 'ready', 'bought', 'dropped', 'snoozed')),
  snoozed_until     timestamptz,
  decided_at        timestamptz,
  verdict           text        check (verdict in ('comfortable', 'tight', 'not-recommended')),
  verdict_reasoning text        check (char_length(verdict_reasoning) <= 1000),
  tags              text[]      not null default '{}',
  target_price      numeric     check (target_price is null or target_price > 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ready_at >= added_at)
);
create index if not exists wishlist_ready on public.wishlist_items (user_id, status, ready_at);

create table if not exists public.saved_scenarios (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  tool       text        not null check (tool in ('car', 'rent_vs_buy', 'moving_out', 'runway', 'january', 'black_friday', 'two_pot', 'retirement')),
  name       text        not null check (char_length(name) between 1 and 80),
  inputs     jsonb       not null default '{}' check (pg_column_size(inputs) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_scenarios_user_tool on public.saved_scenarios (user_id, tool, updated_at desc);

do $$ declare t text; begin
  foreach t in array array['wishlist_items','saved_scenarios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage their own rows" on public.%I', t);
    execute format('create policy "Users manage their own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.loot_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
select public.add_suspension_policies(array['wishlist_items','saved_scenarios']);

insert into public.feature_flags (key, description) values
  ('wishlist', 'Phase 6 B4 — wishlist with cooling-off'),
  ('tools', 'Phase 6 B4 — tools hub: calculators and seasonal planners')
on conflict (key) do nothing;

-- =============================================================================================================
-- Migration 033 — Goals with a target managed by another app (Northbound), and realtime for goals
--
-- * savings_goals.managed_by: null for ordinary goals. 'northbound' means Northbound (the UK-move planner, signed in
--   with the same Supabase account) keeps this goal's target_amount and target_date in step with the user's main
--   move scenario. Loot shows those two fields read-only. Savings (current_amount, contributions, pausing and
--   auto-allocation) are untouched by Northbound and behave as for any goal.
--   Goals Northbound created before this column existed are recognised in the app by their note (see
--   src/lib/goal-math.ts managedBy), and the backfill below tags them too.
-- * Adds savings_goals and goal_contributions to the supabase_realtime publication so Northbound hears about
--   deposits the moment they happen. Row-level security still applies to realtime: each user only receives
--   changes to their own rows.
--
-- Safe to run twice. Needs nothing beyond the existing savings_goals / goal_contributions tables.
-- =============================================================================================================

alter table public.savings_goals add column if not exists managed_by text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'savings_goals_managed_by_chk') then
    alter table public.savings_goals
      add constraint savings_goals_managed_by_chk check (managed_by is null or managed_by ~ '^[a-z][a-z0-9_]{0,39}$');
  end if;
end
$$;

comment on column public.savings_goals.managed_by is
  'App that owns this goal''s target_amount and target_date (e.g. ''northbound''); null = the user sets them in Loot.';

-- Backfill goals Northbound created before this column existed (it writes this exact note).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'savings_goals' and column_name = 'note') then
    update public.savings_goals
       set managed_by = 'northbound'
     where managed_by is null
       and note like 'Target set by Northbound.%';
  end if;
end
$$;

-- Realtime: add each table once, only where the publication exists (it always does on Supabase).
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['savings_goals', 'goal_contributions'] loop
      if to_regclass('public.' || t) is not null
         and not exists (select 1 from pg_publication_tables
                         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;

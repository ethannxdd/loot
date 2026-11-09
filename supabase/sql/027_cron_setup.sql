-- =============================================================================================================
-- Phase 6 B2 — scheduled jobs. Run ONCE in the Supabase SQL Editor, AFTER:
--   1. Migration 027 has run,
--   2. pg_cron and pg_net are enabled (Database → Extensions),
--   3. the edge functions notify-daily and push-dispatch are deployed (see docs/phase-6/SETUP.md),
--   4. the CRON_SECRET edge secret is set.
-- Replace the two placeholders below. Safe to run again: existing secrets/jobs are replaced.
-- =============================================================================================================

-- 1. Secrets in Vault (the SQL can read them; they never appear in job definitions).
select vault.create_secret('https://<project-ref>.supabase.co', 'loot_project_url')
where not exists (select 1 from vault.secrets where name = 'loot_project_url');
select vault.create_secret('<the same long random value as the CRON_SECRET edge secret>', 'loot_cron_secret')
where not exists (select 1 from vault.secrets where name = 'loot_cron_secret');
-- To change one later: select vault.update_secret((select id from vault.secrets where name = 'loot_cron_secret'), '<new>');

-- 2. Helper the jobs use to call an edge function with the cron secret.
create or replace function public.call_edge(fn text, body jsonb default '{}')
returns bigint language sql security definer set search_path = public, extensions, vault as $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'loot_project_url') || '/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'loot_cron_secret')),
    body    := body,
    timeout_milliseconds := 60000);
$$;
revoke all on function public.call_edge(text, jsonb) from public, anon, authenticated;

-- 3. The schedule (UTC). South Africa is UTC+2 all year.
select cron.unschedule(jobid) from cron.job where jobname in ('loot-notify-daily', 'loot-notify-weekly', 'loot-push-dispatch');
select cron.schedule('loot-notify-daily',  '0 5 * * *',   $$ select public.call_edge('notify-daily', '{"run":"daily"}') $$);  -- 07:00 SAST
select cron.schedule('loot-notify-weekly', '0 16 * * 0',  $$ select public.call_edge('notify-daily', '{"run":"weekly"}') $$); -- Sun 18:00 SAST
select cron.schedule('loot-push-dispatch', '*/5 * * * *', $$ select public.call_edge('push-dispatch') $$);                   -- every 5 min

-- Check: select jobname, schedule, active from cron.job;  Recent runs: select * from cron.job_run_details order by start_time desc limit 20;

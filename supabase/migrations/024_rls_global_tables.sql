-- Migration 024 — turn on Row Level Security for the three global (non-user) tables.
--
-- These tables hold no personal data, so they were originally created without RLS. But every table in the
-- `public` schema is reachable through Supabase's REST API by anyone holding the anon key (which ships in the
-- browser bundle), so "no RLS" meant anyone could read, insert, update or delete rows — e.g. poison the
-- spending benchmarks every user compares themselves against.
--
-- After this migration:
--   spending_benchmarks  — readable by signed-in users, not writable through the API
--   score_corrections    — readable by signed-in users, not writable through the API
--   benchmark_samples    — RLS on with NO policies: nothing can touch it through the API
--
-- The app only ever reads spending_benchmarks, and refresh_spending_benchmarks() is SECURITY DEFINER,
-- so it keeps working. Safe to run more than once.

alter table public.benchmark_samples   enable row level security;   -- no policies: API access denied
alter table public.spending_benchmarks enable row level security;
alter table public.score_corrections   enable row level security;

drop policy if exists "Signed-in users can read benchmark averages" on public.spending_benchmarks;
create policy "Signed-in users can read benchmark averages"
  on public.spending_benchmarks for select to authenticated using (true);

drop policy if exists "Signed-in users can read score corrections" on public.score_corrections;
create policy "Signed-in users can read score corrections"
  on public.score_corrections for select to authenticated using (true);

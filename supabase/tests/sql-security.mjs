// SQL security suite for Phase 6 migrations, on PGlite with Supabase-style roles and auth.uid().
// Usage: npm run test:sql  (or: node supabase/tests/sql-security.mjs 026_live_loot.sql …)
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const migrations =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(join(repo, 'supabase/migrations')).filter((f) => /^0(2[6-9]|3\d)_.*\.sql$/.test(f)).sort()
const db = new PGlite({ extensions: { pgcrypto } })
let failures = 0
const ok = (name) => console.log(`  ok   ${name}`)
const bad = (name, e) => {
  failures++
  console.log(`  FAIL ${name}${e ? ` — ${e}` : ''}`)
}

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

await db.exec(`
  create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema extensions to anon, authenticated, service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now(), last_sign_in_at timestamptz,
    email_confirmed_at timestamptz default now(), raw_app_meta_data jsonb default '{"provider": "email"}',
    -- The rest of Supabase's real auth.users columns, so a parameter or variable that shares a column's name clashes here too.
    instance_id uuid, aud varchar(255) default 'authenticated', role varchar(255) default 'authenticated', encrypted_password varchar(255),
    invited_at timestamptz, confirmation_token varchar(255), confirmation_sent_at timestamptz, recovery_token varchar(255),
    recovery_sent_at timestamptz, email_change_token_new varchar(255), email_change varchar(255), email_change_sent_at timestamptz,
    raw_user_meta_data jsonb, is_super_admin boolean, updated_at timestamptz, phone text, phone_confirmed_at timestamptz,
    phone_change text, phone_change_token varchar(255), phone_change_sent_at timestamptz, confirmed_at timestamptz,
    email_change_token_current varchar(255), email_change_confirm_status smallint, banned_until timestamptz,
    reauthentication_token varchar(255), reauthentication_sent_at timestamptz, is_sso_user boolean default false,
    deleted_at timestamptz, is_anonymous boolean default false);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, status text);
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  insert into auth.users (id, email) values ('${A}', 'a@test'), ('${B}', 'b@test');

  -- Minimal pre-Phase-6 schema (Migrations 001–024 aren't in the repo); 025 below is the real file.
  create table public.profiles (id uuid primary key references auth.users on delete cascade, display_name text, net_income numeric default 0,
    onboarded_at timestamptz, tutorial_completed boolean default false);
  alter table public.profiles enable row level security;
  create policy "own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  grant select, insert, update, delete on public.profiles to authenticated;
  insert into public.profiles (id) values ('${A}'), ('${B}');
  create table public.expenses (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
    category text, deleted_at timestamptz);
  create table public.savings_goals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, current_amount numeric default 0);
  create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
    kind text, title text, body text, link text, dedupe_key text, read_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(),
    constraint notifications_kind_chk check (kind in ('system', 'upcoming_debit')), unique (user_id, dedupe_key));
  alter table public.notifications enable row level security;
  create policy "own notifications" on public.notifications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  grant select, insert, update, delete on public.notifications to authenticated;
  create table public.affordability_checks (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
  create table public.statement_analyses (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
  create table public.planner_plans (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
  create table public.monthly_snapshots (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, month date, locked_at timestamptz);
  create table public.tax_profile (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
  create table public.bureau_scores (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
  create table public.households (id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users on delete cascade);
  create table public.household_members (id uuid primary key default gen_random_uuid(), household_id uuid, user_id uuid references auth.users on delete cascade);
  create table public.spending_benchmarks (income_bracket text, category text, sample_size int);
`)
// The real Migration 025 (admin portal, suspension, flags). Function bodies reference tables from 001–024 that are
// only stubbed here, so body checking is off while it loads.
await db.exec(`set check_function_bodies = off;`)
await db.exec(readFileSync(join(repo, 'supabase/migrations/025_admin_portal.sql'), 'utf8'))
await db.exec(`set check_function_bodies = on;`)

for (const m of migrations) {
  const sql = readFileSync(join(repo, 'supabase/migrations', m), 'utf8')
  for (const pass of [1, 2]) {
    try {
      await db.exec(sql)
      ok(`${m} runs (pass ${pass})`)
    } catch (e) {
      bad(`${m} runs (pass ${pass})`, e.message)
    }
  }
}

async function as(user, fn, aal = 'aal2') {
  await db.exec('reset role')
  if (user === 'anon') {
    await db.exec(`set request.jwt.claim.sub = ''; set request.jwt.claims = ''; set role anon`)
  } else {
    await db.exec(`set request.jwt.claim.sub = '${user}'; set request.jwt.claims = '{"sub": "${user}", "aal": "${aal}"}'; set role authenticated`)
  }
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

async function expectOk(name, fn) {
  try {
    await fn()
    ok(name)
  } catch (e) {
    bad(name, e.message)
  }
}
async function expectFail(name, fn) {
  try {
    await fn()
    bad(name, 'expected an error')
  } catch {
    ok(name)
  }
}
async function expectRows(name, fn, n) {
  try {
    const r = await fn()
    // SELECTs report rows; INSERT/UPDATE/DELETE without RETURNING report affectedRows.
    const got = r.fields?.length ? r.rows.length : r.affectedRows
    if (got === n) ok(name)
    else bad(name, `expected ${n}, got ${got}`)
  } catch (e) {
    bad(name, e.message)
  }
}

/** Puts users A and B (and their profiles) back — the 026 suite deletes A to test cascades. */
async function resetUsers() {
  await db.exec('reset role')
  await db.query(`delete from account_status`)
  await db.query(`insert into auth.users values ($1, 'a@test'), ($2, 'b@test') on conflict do nothing`, [A, B])
  await db.query(`insert into profiles (id) values ($1), ($2) on conflict do nothing`, [A, B])
}

const suites = {
  async '026_live_loot.sql'() {
    console.log('Migration 026 — spend_entries / spend_merchant_rules')
    await expectOk('A logs a spend', () => as(A, () => db.query(`insert into spend_entries (user_id, amount, merchant, category) values ($1, 85, 'Woolworths', 'groceries')`, [A])))
    await expectOk('A saves a merchant rule', () => as(A, () => db.query(`insert into spend_merchant_rules (user_id, merchant_key, category) values ($1, 'woolworths', 'groceries')`, [A])))
    await expectRows('A reads own entry', () => as(A, () => db.query('select * from spend_entries')), 1)
    await expectRows('B cannot read A entries', () => as(B, () => db.query('select * from spend_entries')), 0)
    await expectRows('B cannot read A merchant rules', () => as(B, () => db.query('select * from spend_merchant_rules')), 0)
    await expectFail('B cannot insert as A', () => as(B, () => db.query(`insert into spend_entries (user_id, amount) values ($1, 10)`, [A])))
    await expectRows('B update of A rows touches nothing', () => as(B, () => db.query(`update spend_entries set amount = 1`)), 0)
    await expectRows('B delete of A rows touches nothing', () => as(B, () => db.query(`delete from spend_entries`)), 0)
    await expectFail('anon cannot read spend_entries', () => as('anon', () => db.query('select * from spend_entries')))
    await expectFail('anon cannot read merchant rules', () => as('anon', () => db.query('select * from spend_merchant_rules')))
    await expectFail('amount 0 rejected', () => as(A, () => db.query(`insert into spend_entries (user_id, amount) values ($1, 0)`, [A])))
    await expectFail('bad source rejected', () => as(A, () => db.query(`insert into spend_entries (user_id, amount, source) values ($1, 5, 'bank')`, [A])))
    await expectOk('negative amount (money back) allowed', () => as(A, () => db.query(`insert into spend_entries (user_id, amount) values ($1, -20)`, [A])))
    await expectFail('dedupe hash unique per user', () =>
      as(A, async () => {
        await db.query(`insert into spend_entries (user_id, amount, external_hash) values ($1, 5, 'h1')`, [A])
        await db.query(`insert into spend_entries (user_id, amount, external_hash) values ($1, 5, 'h1')`, [A])
      }),
    )
    await expectOk('payday columns writable by owner', () => as(A, () => db.query(`update profiles set payday_day = 25, payday_rule = 'next_working_day' where id = $1`, [A])))
    await expectFail('payday_day 32 rejected', () => as(A, () => db.query(`update profiles set payday_day = 32 where id = $1`, [A])))
    await expectFail('unknown payday_rule rejected', () => as(A, () => db.query(`update profiles set payday_rule = 'whenever' where id = $1`, [A])))

    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectRows('suspended A can still read', () => as(A, () => db.query('select * from spend_entries')), 3)
    await expectFail('suspended A cannot insert', () => as(A, () => db.query(`insert into spend_entries (user_id, amount) values ($1, 1)`, [A])))
    await expectRows('suspended A update touches nothing', () => as(A, () => db.query(`update spend_entries set amount = 2`)), 0)
    await expectRows('suspended A delete touches nothing', () => as(A, () => db.query(`delete from spend_entries`)), 0)
    await expectFail('suspended A cannot add merchant rule', () => as(A, () => db.query(`insert into spend_merchant_rules (user_id, merchant_key, category) values ($1, 'x', 'other')`, [A])))
    await db.query(`delete from account_status where user_id = $1`, [A])

    await expectFail('authenticated cannot call add_suspension_policies', () => as(A, () => db.query(`select public.add_suspension_policies(array['spend_entries'])`)))
    await expectRows('live_cycle flag seeded off', () => db.query(`select 1 from feature_flags where key = 'live_cycle' and not enabled_globally`), 1)
    await expectOk('updated_at trigger fires', async () => {
      const r = await db.query(`update spend_entries set note = 'x' where amount = 85 returning updated_at > created_at or updated_at = now() as moved`)
      if (!r.rows[0]?.moved) throw new Error('updated_at not touched')
    })
    await expectOk('deleting the auth user cascades', async () => {
      await db.query(`delete from auth.users where id = $1`, [A])
      const r = await db.query(`select (select count(*) from spend_entries) + (select count(*) from spend_merchant_rules) as n`)
      if (Number(r.rows[0].n) !== 0) throw new Error(`rows left: ${r.rows[0].n}`)
    })
  },
  async '027_push_capture.sql'() {
    console.log('Migration 027 — push_subscriptions / push_deliveries / capture_keys')
    await resetUsers()
    const sub = (u, n) =>
      db.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth, platform) values ($1, $2, 'k', 'a', 'pwa')`, [u, `https://push.example/${n}`])
    await expectOk('A saves a push subscription', () => as(A, () => sub(A, 'a1')))
    await expectFail('B cannot save a subscription as A', () => as(B, () => sub(A, 'b1')))
    await expectRows('B cannot see A subscriptions', () => as(B, () => db.query('select * from push_subscriptions')), 0)
    await expectFail('http endpoint rejected', () =>
      as(A, () => db.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth, platform) values ($1, 'http://x', 'k', 'a', 'pwa')`, [A])),
    )
    await expectFail('anon cannot read subscriptions', () => as('anon', () => db.query('select * from push_subscriptions')))
    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectRows('suspended A can still turn push off', () => as(A, () => db.query(`delete from push_subscriptions where user_id = $1`, [A])), 1)
    await expectFail('suspended A cannot create a capture key', () => as(A, () => db.query('select public.create_capture_key()')))
    await db.query(`delete from account_status`)

    await expectFail('clients cannot read push_deliveries', () => as(A, () => db.query('select * from push_deliveries')))
    await expectFail('clients cannot read capture_keys', () => as(A, () => db.query('select * from capture_keys')))
    let key = ''
    await expectOk('A creates a capture key (returned once)', async () => {
      const r = await as(A, () => db.query('select public.create_capture_key() as k'))
      key = r.rows[0].k
      if (!/^loot_cap_[0-9a-f]{48}$/.test(key)) throw new Error(`bad key ${key}`)
    })
    await expectOk('only the SHA-256 is stored', async () => {
      const r = await db.query(
        `select key_hash = encode(extensions.digest($1, 'sha256'), 'hex') as ok, key_hash <> $1 as hidden from capture_keys where user_id = $2`,
        [key, A],
      )
      if (!r.rows[0]?.ok || !r.rows[0]?.hidden) throw new Error('hash mismatch')
    })
    await expectOk('status shows active without the key', async () => {
      const r = await as(A, () => db.query('select public.my_capture_key_status() as s'))
      if (!r.rows[0].s.active || JSON.stringify(r.rows[0].s).includes('loot_cap')) throw new Error(JSON.stringify(r.rows[0].s))
    })
    await expectFail('clients cannot call use_capture_key', () => as(A, () => db.query(`select public.use_capture_key('x')`)))
    await expectOk('use_capture_key returns the owner and counts uses', async () => {
      const r = await db.query(`select public.use_capture_key(encode(extensions.digest($1, 'sha256'), 'hex')) as u`, [key])
      if (r.rows[0].u !== A) throw new Error('wrong user')
    })
    await expectFail('a wrong key hash is rejected', () => db.query(`select public.use_capture_key('${'0'.repeat(64)}')`))
    await expectFail('the 201st use in a day is refused', async () => {
      await db.query(
        `update capture_keys set uses_today = 200, uses_day = (now() at time zone 'Africa/Johannesburg')::date where user_id = $1`,
        [A],
      )
      await db.query(`select public.use_capture_key(encode(extensions.digest($1, 'sha256'), 'hex'))`, [key])
    })
    await expectOk('B revoking does not touch A key', async () => {
      await as(B, () => db.query('select public.revoke_capture_key()'))
      const r = await db.query('select count(*)::int n from capture_keys where user_id = $1', [A])
      if (r.rows[0].n !== 1) throw new Error('A key gone')
    })
    await expectOk('A revokes', async () => {
      await as(A, () => db.query('select public.revoke_capture_key()'))
      const r = await db.query('select count(*)::int n from capture_keys')
      if (r.rows[0].n !== 0) throw new Error('still there')
    })
    await expectFail('anon cannot create keys', () => as('anon', () => db.query('select public.create_capture_key()')))
    await expectOk('new notification kinds allowed', () =>
      db.query(`insert into notifications (user_id, kind, title, body, dedupe_key) values ($1, 'payday', 't', 'b', 'p1')`, [A]),
    )
    await expectFail('unknown kinds still rejected', () =>
      db.query(`insert into notifications (user_id, kind, title, body, dedupe_key) values ($1, 'spam', 't', 'b', 'p2')`, [A]),
    )
    await expectOk('mark_push_clicked only for own deliveries', async () => {
      const r = await db.query(`insert into push_deliveries (user_id, kind, status) values ($1, 'payday', 'sent') returning id`, [A])
      const id = r.rows[0].id
      await as(B, () => db.query('select public.mark_push_clicked($1)', [id]))
      const b = await db.query('select clicked_at from push_deliveries where id = $1', [id])
      if (b.rows[0].clicked_at) throw new Error('B could click A delivery')
      await as(A, () => db.query('select public.mark_push_clicked($1)', [id]))
      const a = await db.query('select clicked_at from push_deliveries where id = $1', [id])
      if (!a.rows[0].clicked_at) throw new Error('A click not recorded')
    })
    await expectRows('flags seeded', () => db.query(`select 1 from feature_flags where key in ('push', 'apple_pay_capture')`), 2)
  },
  async '028_people.sql'() {
    console.log('Migration 028 — stokvels / splits / once-off income')
    await resetUsers()
    let svA = ''
    let spA = ''
    await expectOk('A creates a stokvel', async () => {
      const r = await as(A, () =>
        db.query(
          `insert into stokvels (user_id, name, type, contribution_amount, start_month, member_count, my_position) values ($1, 'Club', 'rotating', 1000, '2027-01-01', 12, 4) returning id`,
          [A],
        ),
      )
      svA = r.rows[0].id
    })
    await expectOk('A adds a member and a payment', () =>
      as(A, async () => {
        await db.query(`insert into stokvel_members (stokvel_id, user_id, name, position, is_me) values ($1, $2, 'You', 4, true)`, [svA, A])
        await db.query(`insert into stokvel_payments (stokvel_id, user_id, month, kind, amount) values ($1, $2, '2027-01-01', 'contribution', 1000)`, [svA, A])
      }),
    )
    await expectFail('duplicate month payment rejected', () =>
      as(A, () => db.query(`insert into stokvel_payments (stokvel_id, user_id, month, kind, amount) values ($1, $2, '2027-01-01', 'contribution', 1000)`, [svA, A])),
    )
    await expectRows('B cannot read A stokvels', () => as(B, () => db.query('select * from stokvels')), 0)
    await expectRows('B cannot read A members', () => as(B, () => db.query('select * from stokvel_members')), 0)
    await expectFail("B cannot add a member to A's stokvel (even as themselves)", () =>
      as(B, () => db.query(`insert into stokvel_members (stokvel_id, user_id, name) values ($1, $2, 'Sneaky')`, [svA, B])),
    )
    await expectFail("B cannot add a payment to A's stokvel", () =>
      as(B, () => db.query(`insert into stokvel_payments (stokvel_id, user_id, month, kind, amount) values ($1, $2, '2027-02-01', 'contribution', 1)`, [svA, B])),
    )
    await expectRows('B update of A stokvels touches nothing', () => as(B, () => db.query(`update stokvels set name = 'x'`)), 0)
    await expectFail('member_count 1 rejected', () =>
      as(A, () => db.query(`insert into stokvels (user_id, name, type, contribution_amount, start_month, member_count) values ($1, 'x', 'savings', 10, '2027-01-01', 1)`, [A])),
    )

    await expectOk('A creates a split with shares', async () => {
      const r = await as(A, () => db.query(`insert into splits (user_id, title, total, paid_by) values ($1, 'Airbnb', 1200, 'me') returning id`, [A]))
      spA = r.rows[0].id
      await as(A, () =>
        db.query(
          `insert into split_shares (split_id, user_id, person_name, is_me, amount) values ($1, $2, 'You', true, 300), ($1, $2, 'Thabo', false, 300)`,
          [spA, A],
        ),
      )
    })
    await expectFail("B cannot add a share to A's split", () =>
      as(B, () => db.query(`insert into split_shares (split_id, user_id, person_name, amount) values ($1, $2, 'Me', 1)`, [spA, B])),
    )
    await expectRows('B cannot read A shares', () => as(B, () => db.query('select * from split_shares')), 0)
    await expectFail('negative share amount rejected', () =>
      as(A, () => db.query(`insert into split_shares (split_id, user_id, person_name, amount) values ($1, $2, 'X', -1)`, [spA, A])),
    )
    await expectOk('A records once-off income', () =>
      as(A, () => db.query(`insert into once_off_income (user_id, label, amount, expected_on, kind, source_id) values ($1, 'Club payout', 12000, '2027-04-01', 'stokvel', $2)`, [A, svA])),
    )
    await expectRows('B cannot read A once-off income', () => as(B, () => db.query('select * from once_off_income')), 0)
    await expectFail('anon cannot read splits', () => as('anon', () => db.query('select * from splits')))
    await expectFail('anon cannot read stokvels', () => as('anon', () => db.query('select * from stokvels')))

    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectRows('suspended A can read', () => as(A, () => db.query('select * from stokvels')), 1)
    await expectFail('suspended A cannot add a split', () => as(A, () => db.query(`insert into splits (user_id, title, total, paid_by) values ($1, 'x', 1, 'me')`, [A])))
    await expectRows('suspended A cannot settle a share', () => as(A, () => db.query(`update split_shares set settled_amount = 300`)), 0)
    await expectRows('suspended A cannot delete a stokvel', () => as(A, () => db.query(`delete from stokvels`)), 0)
    await db.query(`delete from account_status`)

    await expectOk('PayShap ID: valid saved, junk rejected', async () => {
      await as(A, () => db.query(`update profiles set payshap_id = '0821234567@capitec' where id = $1`, [A]))
      let failed = false
      try {
        await as(A, () => db.query(`update profiles set payshap_id = 'drop table;' where id = $1`, [A]))
      } catch {
        failed = true
      }
      if (!failed) throw new Error('junk accepted')
    })
    await expectOk('deleting a stokvel cascades members + payments', async () => {
      await as(A, () => db.query('delete from stokvels where id = $1', [svA]))
      const r = await db.query('select (select count(*) from stokvel_members) + (select count(*) from stokvel_payments) as n')
      if (Number(r.rows[0].n) !== 0) throw new Error('children left')
    })
    await expectRows('flags seeded', () => db.query(`select 1 from feature_flags where key in ('stokvels', 'splits')`), 2)
  },
  async '029_decide.sql'() {
    console.log('Migration 029 — wishlist_items / saved_scenarios')
    await resetUsers()
    const wish = (u) =>
      db.query(
        `insert into wishlist_items (user_id, name, price, cool_off_days, ready_at) values ($1, 'AirPods', 4500, 2, now() + interval '2 days')`,
        [u],
      )
    await expectOk('A adds a wishlist item', () => as(A, () => wish(A)))
    await expectFail('B cannot add as A', () => as(B, () => wish(A)))
    await expectRows('B cannot read A wishlist', () => as(B, () => db.query('select * from wishlist_items')), 0)
    await expectRows('B update touches nothing', () => as(B, () => db.query(`update wishlist_items set status = 'dropped'`)), 0)
    await expectFail('cool-off of 5 days rejected', () =>
      as(A, () => db.query(`insert into wishlist_items (user_id, name, price, cool_off_days, ready_at) values ($1, 'x', 1, 5, now())`, [A])),
    )
    await expectFail('ready_at before added_at rejected', () =>
      as(A, () => db.query(`insert into wishlist_items (user_id, name, price, cool_off_days, ready_at) values ($1, 'x', 1, 2, now() - interval '1 day')`, [A])),
    )
    await expectFail('javascript: url rejected', () =>
      as(A, () =>
        db.query(`insert into wishlist_items (user_id, name, price, cool_off_days, ready_at, url) values ($1, 'x', 1, 2, now(), 'javascript:alert(1)')`, [A]),
      ),
    )
    await expectOk('A saves a scenario', () =>
      as(A, () => db.query(`insert into saved_scenarios (user_id, tool, name, inputs) values ($1, 'car', 'Polo', '{"price": 300000}')`, [A])),
    )
    await expectFail('unknown tool rejected', () =>
      as(A, () => db.query(`insert into saved_scenarios (user_id, tool, name) values ($1, 'lottery', 'x')`, [A])),
    )
    await expectFail('oversized inputs rejected', () =>
      as(A, () =>
        db.query(`insert into saved_scenarios (user_id, tool, name, inputs) values ($1, 'car', 'big', jsonb_build_object('blob', repeat('x', 30000)))`, [A]),
      ),
    )
    await expectRows('B cannot read A scenarios', () => as(B, () => db.query('select * from saved_scenarios')), 0)
    await expectFail('anon cannot read wishlist', () => as('anon', () => db.query('select * from wishlist_items')))
    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectRows('suspended A can read', () => as(A, () => db.query('select * from wishlist_items')), 1)
    await expectFail('suspended A cannot add', () => as(A, () => wish(A)))
    await expectRows('suspended A cannot decide', () => as(A, () => db.query(`update wishlist_items set status = 'bought'`)), 0)
    await db.query(`delete from account_status`)
    await expectRows('flags seeded', () => db.query(`select 1 from feature_flags where key in ('wishlist', 'tools')`), 2)
  },
  async '030_stay_ahead.sql'() {
    console.log('Migration 030 — app_settings / price_events / renewals / challenges')
    await resetUsers()
    await expectFail('clients cannot read app_settings directly', () => as(A, () => db.query('select * from app_settings')))
    await expectFail('anon cannot call app_content()', () => as('anon', () => db.query('select public.app_content()')))
    await expectOk('signed-in users get published content only', async () => {
      const r = await as(A, () => db.query('select public.app_content() as c'))
      const c = r.rows[0].c
      if (c.prime_rate?.rate !== 10.75) throw new Error('prime missing')
      if ('shortcut_url' in c) throw new Error('unpublished key leaked')
      if (c['tax_tables:2026/27']?.brackets?.length !== 7) throw new Error('tax table missing')
    })
    await expectOk('re-running the migration never overwrites a published value', async () => {
      await db.query(`update app_settings set value = '{"rate": 11, "effective": "2026-11-20"}' where key = 'prime_rate'`)
      const sql = readFileSync(join(repo, 'supabase/migrations/030_stay_ahead.sql'), 'utf8')
      await db.exec(sql)
      const r = await db.query(`select value->>'rate' as rate from app_settings where key = 'prime_rate'`)
      if (r.rows[0].rate !== '11') throw new Error('overwritten')
    })
    await expectRows('price event drafts are invisible to users', () => as(A, () => db.query('select * from price_events')), 0)
    await expectOk('published events are visible', async () => {
      await db.query(`update price_events set status = 'published', change_pct = 5 where kind = 'medical_aid'`)
      const r = await as(A, () => db.query('select * from price_events'))
      if (r.rows.length !== 1) throw new Error(`saw ${r.rows.length}`)
    })
    await expectFail('users cannot write price events', () =>
      as(A, () => db.query(`insert into price_events (kind, title, effective_on, category, change_pct, status) values ('other', 'x', now(), 'other', 1, 'published')`)),
    )
    await expectFail('anon cannot read price events', () => as('anon', () => db.query('select * from price_events')))

    await expectOk('A adds a renewal', () =>
      as(A, () => db.query(`insert into renewals (user_id, name, kind, renews_on) values ($1, 'Car insurance', 'insurance', '2026-12-01')`, [A])),
    )
    await expectRows('B cannot read A renewals', () => as(B, () => db.query('select * from renewals')), 0)
    await expectFail('reminder_days 200 rejected', () =>
      as(A, () => db.query(`insert into renewals (user_id, name, kind, renews_on, reminder_days) values ($1, 'x', 'other', now(), 200)`, [A])),
    )
    let chA = ''
    await expectOk('A starts a challenge and checks in', async () => {
      const r = await as(A, () =>
        db.query(`insert into challenges (user_id, kind, title, starts_on, ends_on) values ($1, 'no_spend_weekend', 'NSW', '2026-11-14', '2026-11-15') returning id`, [A]),
      )
      chA = r.rows[0].id
      await as(A, () => db.query(`insert into challenge_checkins (challenge_id, user_id, day, success) values ($1, $2, '2026-11-14', true)`, [chA, A]))
    })
    await expectFail("B cannot check in to A's challenge", () =>
      as(B, () => db.query(`insert into challenge_checkins (challenge_id, user_id, day, success) values ($1, $2, '2026-11-15', true)`, [chA, B])),
    )
    await expectFail('ends before it starts rejected', () =>
      as(A, () => db.query(`insert into challenges (user_id, kind, title, starts_on, ends_on) values ($1, 'custom', 'x', '2026-11-15', '2026-11-14')`, [A])),
    )
    await expectOk('expense increase columns accept valid values only', async () => {
      await db.query(`alter table expenses add column if not exists amount numeric`)
      await db.query(`insert into expenses (user_id, increase_month, increase_pct) values ($1, 1, 9)`, [A])
      let failed = false
      try {
        await db.query(`insert into expenses (user_id, increase_month) values ($1, 13)`, [A])
      } catch {
        failed = true
      }
      if (!failed) throw new Error('month 13 accepted')
    })
    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectFail('suspended A cannot add a renewal', () =>
      as(A, () => db.query(`insert into renewals (user_id, name, kind, renews_on) values ($1, 'x', 'other', now())`, [A])),
    )
    await expectRows('suspended A can still read renewals', () => as(A, () => db.query('select * from renewals')), 1)
    await db.query(`delete from account_status`)
    await expectRows('flags seeded', () => db.query(`select 1 from feature_flags where key in ('renewals', 'challenges')`), 2)
  },
  async '031_future_you.sql'() {
    console.log('Migration 031 — tfsa_contributions / retirement_profile / assistant_usage')
    await resetUsers()
    await expectOk('A logs a TFSA contribution', () =>
      as(A, () => db.query(`insert into tfsa_contributions (user_id, tax_year, amount, contributed_on) values ($1, '2026/27', 40000, '2026-06-01')`, [A])),
    )
    await expectFail('bad tax year format rejected', () =>
      as(A, () => db.query(`insert into tfsa_contributions (user_id, tax_year, amount, contributed_on) values ($1, '2026', 1, now())`, [A])),
    )
    await expectRows('B cannot read A TFSA', () => as(B, () => db.query('select * from tfsa_contributions')), 0)
    await expectOk('A saves a retirement profile', () =>
      as(A, () => db.query(`insert into retirement_profile (user_id, retirement_age, ra_balance) values ($1, 65, 100000)`, [A])),
    )
    await expectFail('B cannot write A retirement profile', () =>
      as(B, () => db.query(`insert into retirement_profile (user_id) values ($1)`, [A])),
    )
    await expectFail('clients cannot read assistant_usage', () => as(A, () => db.query('select * from assistant_usage')))
    await expectFail('anon cannot use Ask Loot', () => as('anon', () => db.query(`select public.use_assistant_question('question')`)))

    await expectOk('acceptance: the 31st question in a day is refused', async () => {
      for (let i = 0; i < 30; i++) await as(A, () => db.query(`select public.use_assistant_question('question')`))
      let refused = false
      try {
        await as(A, () => db.query(`select public.use_assistant_question('question')`))
      } catch (e) {
        refused = /daily limit/.test(e.message)
      }
      if (!refused) throw new Error('31st allowed')
      const u = await as(A, () => db.query('select public.my_assistant_usage() as u'))
      if (u.rows[0].u.used !== 30 || u.rows[0].u.cap !== 30) throw new Error(JSON.stringify(u.rows[0].u))
    })
    await expectOk('a refused request is not counted', async () => {
      const r = await db.query(`select questions from assistant_usage where user_id = $1`, [A])
      if (r.rows[0].questions !== 30) throw new Error(`counted ${r.rows[0].questions}`)
    })
    await expectOk('acceptance: the cap follows app_settings.assistant_daily_cap', async () => {
      await db.query(`update app_settings set value = '35' where key = 'assistant_daily_cap'`)
      await as(A, () => db.query(`select public.use_assistant_question('question')`))
      await db.query(`update app_settings set value = '30' where key = 'assistant_daily_cap'`)
    })
    await expectOk('continue calls are capped at 5 × the question cap', async () => {
      for (let i = 0; i < 150 - 31; i++) await as(B, () => db.query(`select public.use_assistant_question('continue')`))
      let refused = false
      try {
        for (let i = 0; i < 40; i++) await as(B, () => db.query(`select public.use_assistant_question('continue')`))
      } catch (e) {
        refused = /daily limit/.test(e.message)
      }
      if (!refused) throw new Error('continue never capped')
    })
    await expectOk('calling with no argument counts a question (draft compatibility)', async () => {
      await as(A, () => db.query(`delete from assistant_usage where user_id = $1`, [A]).catch(() => undefined))
      await db.query(`delete from assistant_usage where user_id = $1`, [A])
      await as(A, () => db.query('select public.use_assistant_question()'))
      const r = await db.query(`select questions from assistant_usage where user_id = $1`, [A])
      if (r.rows[0]?.questions !== 1) throw new Error('not counted as a question')
    })
    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectFail('suspended A cannot use Ask Loot', () => as(A, () => db.query(`select public.use_assistant_question('question')`)))
    await expectFail('suspended A cannot add TFSA', () =>
      as(A, () => db.query(`insert into tfsa_contributions (user_id, tax_year, amount, contributed_on) values ($1, '2026/27', 1, now())`, [A])),
    )
    await db.query(`delete from account_status`)
    await expectRows('future_you flag seeded', () => db.query(`select 1 from feature_flags where key = 'future_you'`), 1)
  },
  async '032_admin_v2.sql'() {
    console.log('Migration 032 — admin portal v2')
    await resetUsers()
    const O = '33333333-3333-3333-3333-333333333333'
    const S = '44444444-4444-4444-4444-444444444444'
    const V = '55555555-5555-5555-5555-555555555555'
    await db.query(`insert into auth.users (id, email) values ($1, 'owner@test'), ($2, 'support@test'), ($3, 'viewer@test') on conflict do nothing`, [O, S, V])
    await db.query(`insert into profiles (id) values ($1), ($2), ($3) on conflict do nothing`, [O, S, V])
    await db.query(`insert into admin_users (user_id, role) values ($1, 'owner'), ($2, 'support'), ($3, 'viewer') on conflict do nothing`, [O, S, V])
    await db.query(`insert into app_activity (user_id, day, platform) values ($1, current_date, 'pwa'), ($2, current_date, 'browser') on conflict do nothing`, [A, B])

    const READS = [
      ['admin_list_feedback()', []],
      ['admin_list_content()', []],
      ['admin_list_announcements()', []],
      ['admin_list_saved_replies()', []],
      ['admin_overview_stats(30)', []],
      ['admin_user_detail($1)', [A]],
      ['admin_analytics_retention(90)', []],
      ['admin_analytics_engagement(30)', []],
      ['admin_analytics_features(30)', []],
      ['admin_analytics_notifications(30)', []],
      ['admin_analytics_support(30)', []],
      [`admin_announcement_reach('{"all": true}')`, []],
      [`admin_price_event_reach('groceries')`, []],
    ]
    for (const [fn, args] of READS) {
      await expectFail(`anon refused: ${fn}`, () => as('anon', () => db.query(`select public.${fn}`, args)))
      await expectFail(`normal user refused: ${fn}`, () => as(A, () => db.query(`select public.${fn}`, args)))
      await expectFail(`aal1 admin refused: ${fn}`, () => as(O, () => db.query(`select public.${fn}`, args), 'aal1'))
      await expectOk(`viewer (aal2) can read: ${fn}`, () => as(V, () => db.query(`select public.${fn}`, args)))
    }

    // Feedback round trip — the user side works while suspended.
    let fb = ''
    await db.query(`insert into account_status (user_id, status) values ($1, 'suspended')`, [A])
    await expectOk('suspended user can send feedback', async () => {
      const r = await as(A, () => db.query(`select public.send_feedback('problem', 'The hero is blank', '{"route": "/dashboard", "platform": "pwa"}') as id`))
      fb = r.rows[0].id
    })
    await db.query(`delete from account_status`)
    await expectFail('users cannot read feedback tables directly', () => as(A, () => db.query('select * from feedback')))
    await expectFail('users cannot read notes', () => as(A, () => db.query('select * from feedback_notes')))
    await expectFail("B cannot open A's thread", () => as(B, () => db.query('select public.my_feedback_thread($1)', [fb])))
    await expectFail("B cannot reply on A's thread", () => as(B, () => db.query(`select public.reply_feedback($1, 'hi')`, [fb])))
    await expectFail('viewer cannot reply', () => as(V, () => db.query(`select public.admin_reply_feedback($1, 'hi')`, [fb])))
    await expectOk('support replies → user notification + unread', async () => {
      await as(S, () => db.query(`select public.admin_reply_feedback($1, 'Thanks — fixing it')`, [fb]))
      await as(S, () => db.query(`select public.admin_add_feedback_note($1, 'Repro on iOS 18')`, [fb]))
      const n = await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'feedback_reply'`, [A])
      if (n.rows[0].n !== 1) throw new Error('no notification')
      const mine = await as(A, () => db.query('select public.my_feedback() as f'))
      if (!mine.rows[0].f[0].unread) throw new Error('not unread')
      const thread = await as(A, () => db.query('select public.my_feedback_thread($1) as t', [fb]))
      if (JSON.stringify(thread.rows[0].t).includes('Repro on iOS')) throw new Error('internal note leaked to the user')
      const after = await as(A, () => db.query('select public.my_feedback() as f'))
      if (after.rows[0].f[0].unread) throw new Error('reading did not clear unread')
      await as(A, () => db.query(`select public.reply_feedback($1, 'Still blank')`, [fb]))
    })
    await expectOk('feedback writes are audited', async () => {
      const r = await db.query(`select count(*)::int n from admin_audit_log where action in ('feedback_reply', 'feedback_note')`)
      if (r.rows[0].n < 2) throw new Error('missing audit rows')
    })
    await expectFail('viewer cannot change status', () => as(V, () => db.query(`select public.admin_update_feedback($1, 'resolved')`, [fb])))
    await expectOk('support resolves', () => as(S, () => db.query(`select public.admin_update_feedback($1, 'resolved')`, [fb])))
    await expectFail('support cannot manage saved replies', () => as(S, () => db.query(`select public.admin_save_reply(null, 'Hi', 'Hello')`)))
    await expectOk('owner manages saved replies', () => as(O, () => db.query(`select public.admin_save_reply(null, 'Thanks', 'Thanks for telling us.')`)))

    // Content: role split + publish needs a reason.
    await expectFail('support cannot draft tax tables', () => as(S, () => db.query(`select public.admin_save_setting_draft('tax_tables:2027/28', '{}')`)))
    await expectFail('support cannot draft TFSA limits', () => as(S, () => db.query(`select public.admin_save_setting_draft('tfsa_limits', '{}')`)))
    await expectOk('support drafts + publishes fuel prices', async () => {
      await as(S, () => db.query(`select public.admin_save_setting_draft('fuel_prices', '{"effective": "2026-12-02", "petrol95": {"inland": 31, "coastal": 30}, "diesel": {"inland": 31, "coastal": 30}}')`))
      await as(S, () => db.query(`select public.admin_publish_setting('fuel_prices', 'DMPR December adjustment')`))
      const r = await as(A, () => db.query('select public.app_content() as c'))
      if (r.rows[0].c.fuel_prices.petrol95.inland !== 31) throw new Error('not published')
    })
    await expectFail('publishing needs a reason', async () => {
      await as(O, () => db.query(`select public.admin_save_setting_draft('prime_rate', '{"rate": 10.5, "effective": "2026-11-20"}')`))
      await as(O, () => db.query(`select public.admin_publish_setting('prime_rate', '')`))
    })
    await expectFail('viewer cannot draft', () => as(V, () => db.query(`select public.admin_save_setting_draft('seasons', '{}')`)))
    await expectOk('support saves and publishes a price event', async () => {
      const r = await as(S, () => db.query(`select public.admin_upsert_price_event('{"kind": "fuel", "title": "Fuel Jan", "effective_on": "2027-01-06", "category": "transport", "change_amount": "50", "change_unit": "c/l"}') as id`))
      await as(S, () => db.query(`select public.admin_set_price_event_status($1, 'published', 'Announced by DMPR')`, [r.rows[0].id]))
    })

    // Announcements: Support ≤ 50 / one person; Owner for everyone.
    let one = ''
    let all = ''
    await expectOk('support drafts a one-person announcement', async () => {
      const r = await as(S, () => db.query(`select public.admin_save_announcement($1) as id`, [JSON.stringify({ title: 'Hi', body: 'Hello', channels: ['banner', 'bell'], audience: { user_id: A } })]))
      one = r.rows[0].id
    })
    await expectOk('support sends to one person', () => as(S, () => db.query(`select public.admin_send_announcement($1, 'Support follow-up')`, [one])))
    await expectOk('support drafts an everyone announcement', async () => {
      const r = await as(S, () => db.query(`select public.admin_save_announcement($1) as id`, [JSON.stringify({ title: 'New', body: 'Payday cycles are here', channels: ['banner', 'push'], audience: { all: true } })]))
      all = r.rows[0].id
    })
    await expectFail('support cannot send to everyone', () => as(S, () => db.query(`select public.admin_send_announcement($1, 'Launch')`, [all])))
    await expectOk('owner sends to everyone', () => as(O, () => db.query(`select public.admin_send_announcement($1, 'Launch')`, [all])))
    await expectOk('delivery materialises receipts, bell rows and banner', async () => {
      await db.exec('reset role')
      const n = await db.query('select public.materialise_due_announcements() as n')
      if (n.rows[0].n !== 2) throw new Error(`materialised ${n.rows[0].n}`)
      const banner = await as(A, () => db.query('select public.my_announcements() as a'))
      if (banner.rows[0].a.length !== 2) throw new Error(`A sees ${banner.rows[0].a.length} banners`)
      const bBanner = await as(B, () => db.query('select public.my_announcements() as a'))
      if (bBanner.rows[0].a.length !== 1) throw new Error('B should only get the everyone one')
      const bell = await db.query(`select pushed_at from notifications where kind = 'announcement' and user_id = $1 and announcement_id = $2`, [A, one])
      if (!bell.rows[0] || bell.rows[0].pushed_at === null) throw new Error('bell-only row should be marked not-for-push')
      const push = await db.query(`select pushed_at from notifications where kind = 'announcement' and user_id = $1 and announcement_id = $2`, [A, all])
      if (push.rows[0].pushed_at !== null) throw new Error('push row should wait for push-dispatch')
      await db.query('select public.materialise_due_announcements()')
      const again = await db.query(`select count(*)::int n from announcement_receipts`)
      // One person + everyone (A, B and the three admins) — and a second run adds nothing.
      if (again.rows[0].n !== 6) throw new Error(`receipts: ${again.rows[0].n}`)
    })
    await expectOk('platform audience reaches only installed-app users', async () => {
      const r = await as(V, () => db.query(`select public.admin_announcement_reach('{"platforms": ["pwa"]}') as n`))
      if (r.rows[0].n !== 1) throw new Error(`reach ${r.rows[0].n}`)
    })
    await expectOk('seen / clicked / dismissed are tracked; stats count them', async () => {
      await as(A, () => db.query(`select public.mark_announcement($1, 'clicked')`, [all]))
      await as(A, () => db.query(`select public.mark_announcement($1, 'dismissed')`, [one]))
      const s = await as(V, () => db.query('select public.admin_announcement_stats($1) as s', [all]))
      if (s.rows[0].s.clicked !== 1 || s.rows[0].s.seen !== 1) throw new Error(JSON.stringify(s.rows[0].s))
      const left = await as(A, () => db.query('select public.my_announcements() as a'))
      if (left.rows[0].a.length !== 1) throw new Error('dismissed banner still shown')
    })
    await expectFail('users cannot read announcements directly', () => as(A, () => db.query('select * from announcements')))
    await expectFail('clients cannot materialise', () => as(O, () => db.query('select public.materialise_due_announcements()')))

    // User page actions + replaced functions keep their outputs.
    await expectFail('viewer cannot clear push', () => as(V, () => db.query(`select public.admin_clear_push($1, 'testing')`, [A])))
    await expectOk('support actions', () =>
      as(S, async () => {
        await db.query(`select public.admin_clear_push($1, 'Device lost')`, [A])
        await db.query(`select public.admin_revoke_capture_key($1, 'Key leaked')`, [A])
        await db.query(`select public.admin_reset_assistant_limit($1, 'Testing Ask Loot')`, [A])
        await db.query(`select public.admin_send_test_push($1)`, [A])
      }),
    )
    await expectOk('overview keeps 025 fields and adds Phase 6 ones', async () => {
      const r = await as(V, () => db.query('select public.admin_overview_stats(30) as o'))
      const o = r.rows[0].o
      for (const k of ['users_total', 'funnel', 'attention', 'push_opt_in', 'loggers_7d', 'phase6_attention']) if (!(k in o)) throw new Error(`missing ${k}`)
      if (o.phase6_attention.unanswered_feedback_48h !== 0) throw new Error('feedback count wrong')
    })
    await expectOk('user detail keeps 025 fields and adds Phase 6 ones', async () => {
      const r = await as(V, () => db.query('select public.admin_user_detail($1) as d', [A]))
      const d = r.rows[0].d
      for (const k of ['account', 'status', 'usage', 'flags', 'history', 'phase6']) if (!(k in d)) throw new Error(`missing ${k}`)
      if (!('expenses' in d.usage) || !('spend_entries' in d.usage)) throw new Error('usage not merged')
      if (d.phase6.feedback.length !== 1) throw new Error('feedback threads missing')
    })
    await expectOk('Rule 26: no money fields in admin outputs', async () => {
      const outputs = []
      for (const fn of ['admin_overview_stats(30)', 'admin_analytics_engagement(30)', 'admin_analytics_features(30)', 'admin_analytics_notifications(30)', 'admin_analytics_support(30)', 'admin_analytics_retention(90)']) {
        outputs.push((await as(V, () => db.query(`select public.${fn} as x`))).rows[0].x)
      }
      outputs.push((await as(V, () => db.query('select public.admin_user_detail($1) as x', [A]))).rows[0].x)
      const keys = []
      const walk = (v) => {
        if (Array.isArray(v)) v.forEach(walk)
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x) }
      }
      outputs.forEach(walk)
      const money = keys.filter((k) => /amount|income|balance|price|salary|budget|spent|disposable|net_worth/i.test(k))
      if (money.length) throw new Error(`money keys: ${[...new Set(money)].join(', ')}`)
    })
    await expectOk('audit log stays append-only', async () => {
      let blocked = false
      try {
        await db.query(`delete from admin_audit_log`)
      } catch {
        blocked = true
      }
      if (!blocked) throw new Error('audit rows deleted')
    })
    await expectRows('flags seeded', () => db.query(`select 1 from feature_flags where key in ('feedback', 'announcements_banner')`), 2)
  },
}

for (const m of migrations) if (suites[m]) await suites[m]()
console.log(failures === 0 ? '\nAll SQL checks passed' : `\n${failures} SQL check(s) failed`)
process.exit(failures === 0 ? 0 : 1)

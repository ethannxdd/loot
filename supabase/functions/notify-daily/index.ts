// Loot — notify-daily — Supabase Edge Function (Deno). Phase 6 B2.
// Called by pg_cron (supabase/sql/027_cron_setup.sql) with the x-cron-secret header. Generates the scheduled
// notifications (payday, debit orders tomorrow, weekly pace, budgets running low, + later batches' kinds) and inserts
// them into `notifications`. push-dispatch sends them.
//
// Deploy: npx supabase functions deploy notify-daily --no-verify-jwt
// Secrets: CRON_SECRET (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected).

import { json } from "../_shared/http.ts";
import { extraGenerators } from "../_shared/extras.ts";
import { chunks, loadFlags, serviceClient } from "../_shared/supabase.ts";
import { handleNotifyDaily, type ProfileRow } from "./handler.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let body: { run?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const db = serviceClient();
  try {
    const result = await handleNotifyDaily(req.headers.get("x-cron-secret"), body, {
      cronSecret: Deno.env.get("CRON_SECRET"),
      now: () => new Date(),
      flags: (keys) => loadFlags(db, keys),
      async profiles(offset, limit) {
        const { data, error } = await db
          .from("profiles")
          .select("id, net_income, safety_buffer_pct, currency_code, payday_day, payday_rule")
          .not("onboarded_at", "is", null)
          .order("id")
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as ProfileRow[];
      },
      async expenses(ids) {
        const out = [];
        for (const c of chunks(ids)) {
          const { data, error } = await db.from("expenses").select("*").in("user_id", c).is("deleted_at", null);
          if (error) throw error;
          out.push(...(data ?? []));
        }
        return out;
      },
      async spendEntries(ids, since) {
        const out = [];
        for (const c of chunks(ids)) {
          const { data, error } = await db.from("spend_entries").select("*").in("user_id", c).is("deleted_at", null).gte("spent_at", since);
          if (error) throw error;
          out.push(...(data ?? []));
        }
        return out;
      },
      async insertNotifications(rows) {
        let n = 0;
        for (const c of chunks(rows, 500)) {
          const { data, error } = await db
            .from("notifications")
            .upsert(c, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
            .select("id");
          if (error) throw error;
          n += data?.length ?? 0;
        }
        return n;
      },
      extras: extraGenerators(db),
    });
    return json(result.body, result.status);
  } catch (err) {
    console.error("notify-daily failed", err);
    return json({ error: "notify-daily failed" }, 500);
  }
});

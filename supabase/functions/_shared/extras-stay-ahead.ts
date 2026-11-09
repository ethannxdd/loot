// notify-daily generators for B5: renewals (30 + 7 days), price changes (7 days, only if they affect you) and
// challenge days. Each checks its own flag. Deno only.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ExtraCandidate, ExtraGenerator } from "../notify-daily/handler.ts";
import { flagOn } from "./http.ts";
import { challengeNotice, type Challenge } from "./lib/challenges.ts";
import { formatCurrency } from "./lib/format.ts";
import { priceNotices, renewalNotices, type PriceEvent, type Renewal } from "./lib/stay-ahead.ts";
import type { Expense } from "./lib/types.ts";
import { chunks, loadFlags } from "./supabase.ts";

async function fuelPrice(db: SupabaseClient): Promise<number> {
  const { data } = await db.from("app_settings").select("value").eq("key", "fuel_prices").maybeSingle();
  const v = Number((data?.value as { petrol95?: { inland?: number } } | null)?.petrol95?.inland);
  return Number.isFinite(v) && v > 0 ? v : 30;
}

function stayAhead(db: SupabaseClient): ExtraGenerator {
  return async (userIds, today, run) => {
    if (run !== "daily") return [];
    const flags = await loadFlags(db, ["renewals", "challenges"]);
    const rn = userIds.filter((u) => flagOn(flags.renewals, u));
    const ch = userIds.filter((u) => flagOn(flags.challenges, u));
    const out: ExtraCandidate[] = [];

    if (rn.length > 0) {
      const { data: events } = await db.from("price_events").select("*").eq("status", "published");
      const fuel = await fuelPrice(db);
      for (const c of chunks(rn)) {
        const [{ data: renewals }, { data: expenses }, { data: profiles }] = await Promise.all([
          db.from("renewals").select("*").in("user_id", c).is("ended_at", null),
          db.from("expenses").select("*").in("user_id", c).is("deleted_at", null),
          db.from("profiles").select("id, currency_code").in("id", c),
        ]);
        for (const r of (renewals ?? []) as Renewal[]) for (const n of renewalNotices(r, today)) out.push({ ...n, user_id: r.user_id });
        for (const userId of c) {
          const mine = ((expenses ?? []) as Expense[]).filter((e) => e.user_id === userId).map((e) => ({ ...e, amount: Number(e.amount) }));
          const cur = (profiles ?? []).find((p) => p.id === userId)?.currency_code ?? "ZAR";
          for (const e of (events ?? []) as PriceEvent[]) {
            const ev = { ...e, change_pct: e.change_pct == null ? null : Number(e.change_pct), change_amount: e.change_amount == null ? null : Number(e.change_amount) };
            for (const n of priceNotices(ev, mine, fuel, today, (x) => formatCurrency(x, cur))) out.push({ ...n, user_id: userId });
          }
        }
      }
    }

    for (const c of chunks(ch)) {
      const { data } = await db.from("challenges").select("*").in("user_id", c).eq("status", "active");
      for (const challenge of (data ?? []) as Challenge[]) {
        const n = challengeNotice(challenge, today);
        if (n) out.push({ ...n, user_id: challenge.user_id });
      }
    }
    return out;
  };
}

export function stayAheadGenerators(db: SupabaseClient): ExtraGenerator[] {
  return [stayAhead(db)];
}

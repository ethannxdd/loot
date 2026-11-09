// Generators that later Phase 6 batches add to notify-daily. Each loads its own feature flag and only produces
// notifications for people who have it on. Deno only.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ExtraCandidate, ExtraGenerator } from "../notify-daily/handler.ts";
import { flagOn } from "./http.ts";
import { formatCurrency } from "./lib/format.ts";
import { splitReminders, type Split, type SplitShare } from "./lib/splits.ts";
import { stokvelNotices, type Stokvel } from "./lib/stokvel.ts";
import { chunks, loadFlags } from "./supabase.ts";
import { peopleLater } from "./extras-later.ts";

async function currencies(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const c of chunks(ids)) {
    const { data } = await db.from("profiles").select("id, currency_code").in("id", c);
    for (const p of data ?? []) out.set(p.id, p.currency_code ?? "ZAR");
  }
  return out;
}

/** B3 — stokvel contribution due in 3 days / payout month, and split reminders (daily run only). */
function people(db: SupabaseClient): ExtraGenerator {
  return async (userIds, today, run) => {
    if (run !== "daily") return [];
    const flags = await loadFlags(db, ["stokvels", "splits"]);
    const sv = userIds.filter((u) => flagOn(flags.stokvels, u));
    const sp = userIds.filter((u) => flagOn(flags.splits, u));
    if (sv.length === 0 && sp.length === 0) return [];
    const cur = await currencies(db, [...new Set([...sv, ...sp])]);
    const out: ExtraCandidate[] = [];

    for (const c of chunks(sv)) {
      const { data } = await db.from("stokvels").select("*").in("user_id", c).is("ended_at", null);
      for (const s of (data ?? []) as Stokvel[]) {
        const fmt = (n: number) => formatCurrency(n, cur.get(s.user_id) ?? "ZAR");
        for (const n of stokvelNotices({ ...s, contribution_amount: Number(s.contribution_amount) }, today, fmt)) {
          out.push({ ...n, user_id: s.user_id });
        }
      }
    }

    for (const c of chunks(sp)) {
      const [{ data: splits }, { data: shares }] = await Promise.all([
        db.from("splits").select("*").in("user_id", c).is("deleted_at", null),
        db.from("split_shares").select("*").in("user_id", c).is("settled_at", null),
      ]);
      const allSplits = ((splits ?? []) as Split[]).map((s) => ({ ...s, total: Number(s.total) }));
      const allShares = ((shares ?? []) as SplitShare[]).map((s) => ({ ...s, amount: Number(s.amount), settled_amount: Number(s.settled_amount) }));
      for (const userId of c) {
        const fmt = (n: number) => formatCurrency(n, cur.get(userId) ?? "ZAR");
        const reminders = splitReminders(
          allSplits.filter((s) => s.user_id === userId),
          allShares.filter((s) => s.user_id === userId),
          today,
          fmt,
        );
        for (const { share_id, ...notice } of reminders) {
          const share = allShares.find((s) => s.id === share_id)!;
          out.push({ ...notice, user_id: userId });
          await db
            .from("split_shares")
            .update({ reminders_sent: share.reminders_sent + 1, last_reminded_at: new Date().toISOString() })
            .eq("id", share_id);
        }
      }
    }
    return out;
  };
}

export function extraGenerators(db: SupabaseClient): ExtraGenerator[] {
  return [people(db), ...peopleLater(db)];
}

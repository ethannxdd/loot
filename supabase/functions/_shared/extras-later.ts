// notify-daily generators for B4/B5: wishlist ready, renewals, price changes, challenges. Each checks its own flag.
// Deno only.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ExtraCandidate, ExtraGenerator } from "../notify-daily/handler.ts";
import { flagOn } from "./http.ts";
import { readyToday, type WishlistItem } from "./lib/wishlist.ts";
import { chunks, loadFlags } from "./supabase.ts";
import { stayAheadGenerators } from "./extras-stay-ahead.ts";

/** B4 — "Cooling-off's over for AirPods. Still want them?" on the day an item becomes ready. */
function wishlist(db: SupabaseClient): ExtraGenerator {
  return async (userIds, today, run) => {
    if (run !== "daily") return [];
    const flags = await loadFlags(db, ["wishlist"]);
    const ids = userIds.filter((u) => flagOn(flags.wishlist, u));
    const out: ExtraCandidate[] = [];
    for (const c of chunks(ids)) {
      const { data } = await db.from("wishlist_items").select("*").in("user_id", c).in("status", ["waiting", "ready", "snoozed"]);
      for (const item of readyToday((data ?? []) as WishlistItem[], today)) {
        out.push({
          user_id: item.user_id,
          kind: "wishlist_ready",
          title: "Cooling-off's over",
          body: `Cooling-off's over for ${item.name}. Still want it?`,
          link: "/wishlist",
          dedupe_key: `wishlist_ready:${item.id}:${item.status === "snoozed" ? item.snoozed_until?.slice(0, 10) : "1"}`,
        });
      }
    }
    return out;
  };
}

export function peopleLater(db: SupabaseClient): ExtraGenerator[] {
  return [wishlist(db), ...stayAheadGenerators(db)];
}

// Loot — log-spend — Supabase Edge Function (Deno). Phase 6 B2 — Apple Pay capture via the person's iOS Shortcut.
// POST with `Authorization: Bearer loot_cap_…` and JSON { amount, merchant, card?, at? } → { ok, logged }.
//
// Deploy: npx supabase functions deploy log-spend --no-verify-jwt   (the capture key is the credential, not a JWT)
// No extra secrets.

import { CORS_HEADERS, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { handleLogSpend, type LogSpendBody } from "./handler.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  let body: LogSpendBody = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Send JSON: { amount, merchant }." }, 400);
  }
  const db = serviceClient();
  try {
    const result = await handleLogSpend(req.headers.get("Authorization"), body, {
      now: () => new Date(),
      async useKey(hash) {
        const { data, error } = await db.rpc("use_capture_key", { p_hash: hash });
        if (error) throw new Error(error.message);
        return data as string;
      },
      async merchantCategory(userId, key) {
        const { data } = await db.from("spend_merchant_rules").select("category").eq("user_id", userId).eq("merchant_key", key).maybeSingle();
        return data?.category ?? null;
      },
      async hashExists(userId, hashes) {
        const { data } = await db.from("spend_entries").select("id").eq("user_id", userId).in("external_hash", hashes).limit(1);
        return (data?.length ?? 0) > 0;
      },
      async insert(row) {
        const { error } = await db.from("spend_entries").insert(row);
        if (error?.code === "23505") return false;
        if (error) throw error;
        return true;
      },
      async currency(userId) {
        const { data } = await db.from("profiles").select("currency_code").eq("id", userId).maybeSingle();
        return data?.currency_code ?? "ZAR";
      },
    });
    return json(result.body, result.status);
  } catch (err) {
    console.error("log-spend failed", err);
    return json({ ok: false, error: "Loot couldn't save that spend. Try again." }, 500);
  }
});

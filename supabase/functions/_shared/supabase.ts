// Service-role Supabase client + the shared data access the Phase 6 jobs use. Deno only (npm: specifier).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { FlagState } from "../notify-daily/handler.ts";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Global state + per-user overrides for each flag (Migration 025 tables). */
export async function loadFlags(db: SupabaseClient, keys: string[]): Promise<Record<string, FlagState>> {
  const [{ data: flags }, { data: overrides }] = await Promise.all([
    db.from("feature_flags").select("key, enabled_globally").in("key", keys),
    db.from("user_feature_overrides").select("user_id, flag_key, enabled").in("flag_key", keys),
  ]);
  const out: Record<string, FlagState> = {};
  for (const k of keys) out[k] = { global: false, overrides: new Map() };
  for (const f of flags ?? []) out[f.key].global = Boolean(f.enabled_globally);
  for (const o of overrides ?? []) out[o.flag_key]?.overrides.set(o.user_id, Boolean(o.enabled));
  return out;
}

/** Chunks a list of ids for `in (...)` filters. */
export function chunks<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

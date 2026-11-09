// Small helpers shared by the Phase 6 edge functions. No Deno or Supabase imports, so handlers stay unit-testable.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Constant-time comparison for the cron secret. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the request carries the right x-cron-secret (pg_cron jobs and manual test runs). */
export function cronAuthorised(header: string | null, secret: string | undefined): boolean {
  return Boolean(secret) && safeEqual(header ?? "", secret ?? "");
}

const SAST_MS = 2 * 3_600_000;

/**
 * The South African wall-clock time of `at`, as a Date whose LOCAL fields hold it. The shared cycle maths works in
 * local calendar dates; edge functions run in UTC, so this keeps "today" and every timestamp on SA time.
 */
export function saWallClock(at: Date): Date {
  const u = new Date(at.getTime() + SAST_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
}

/** Same as saWallClock for an ISO string, returned as ISO (for spend_entries.spent_at). */
export function saWallClockIso(iso: string): string {
  return saWallClock(new Date(iso)).toISOString();
}

/** Lower-case hex SHA-256 (Web Crypto — works in Deno and Node 20+). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Is a feature flag on for this user? Per-user override wins over the global switch (Migration 025). */
export function flagOn(flag: { global: boolean; overrides: Map<string, boolean> } | undefined, userId: string): boolean {
  if (!flag) return false;
  const o = flag.overrides.get(userId);
  return o ?? flag.global;
}

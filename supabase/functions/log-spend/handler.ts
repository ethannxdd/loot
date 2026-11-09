// Loot — log-spend — the logic (no Deno / Supabase imports, so it can be unit tested). index.ts wires it up.
//
// The person's own iOS Shortcut ("Log to Loot", run by a Wallet Transaction automation) posts here with their capture
// key: `Authorization: Bearer loot_cap_…`, body { amount, merchant, card?, at? }. Only the key's SHA-256 is stored.
// 200 captures a day; an identical merchant + amount within 2 minutes is a duplicate (Shortcuts can fire twice).
// The card name is never stored (§3.3 privacy promise: amount, shop and time only).

import { sha256Hex, type Result } from "../_shared/http.ts";
import { merchantKey } from "../_shared/lib/spending.ts";
import { formatCurrencyExact } from "../_shared/lib/format.ts";

export interface LogSpendDeps {
  /** Checks the key hash, counts the use and returns the user id. Throws 'invalid key' or 'daily limit'. */
  useKey(hash: string): Promise<string>;
  /** The category remembered for this merchant key, if any. */
  merchantCategory(userId: string, key: string): Promise<string | null>;
  /** True if an entry with one of these hashes already exists for the user. */
  hashExists(userId: string, hashes: string[]): Promise<boolean>;
  /** Inserts the entry. Returns false on a unique-hash conflict (a duplicate that raced us). */
  insert(row: {
    user_id: string;
    amount: number;
    merchant: string | null;
    category: string | null;
    spent_at: string;
    source: "apple_pay";
    external_hash: string;
  }): Promise<boolean>;
  currency(userId: string): Promise<string>;
  now(): Date;
}

export interface LogSpendBody {
  amount?: unknown;
  merchant?: unknown;
  card?: unknown;
  at?: unknown;
}

/**
 * Parses amounts the way Wallet and people write them: "R 1 234,50", "ZAR1234.50", "1234.5", "R1,234.50",
 * "1.234,50", "R85". Returns NaN for anything unusable.
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : NaN;
  if (typeof raw !== "string") return NaN;
  let s = raw.replace(/[\s  ]/g, "").replace(/^(ZAR|R)/i, "").replace(/(ZAR|R)$/i, "");
  if (!/^-?[\d.,]+$/.test(s)) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    const commas = s.split(",").length - 1;
    s = commas === 1 && decimals <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const dots = s.split(".").length - 1;
    if (dots > 1) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const DEDUPE_WINDOW_MS = 2 * 60_000;

/** Dedupe hashes for the 2-minute bucket of `at` and the one before it. */
export async function dedupeHashes(userId: string, key: string, amount: number, at: Date): Promise<[string, string]> {
  const bucket = Math.floor(at.getTime() / DEDUPE_WINDOW_MS);
  const h = (b: number) => sha256Hex(`${userId}|${key}|${amount.toFixed(2)}|${b}`);
  return [await h(bucket), await h(bucket - 1)];
}

export async function handleLogSpend(authHeader: string | null, body: LogSpendBody, deps: LogSpendDeps): Promise<Result> {
  const key = (authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^loot_cap_[0-9a-f]{48}$/.test(key)) return { status: 401, body: { ok: false, error: "That capture key isn't valid." } };

  const amount = parseAmount(body?.amount);
  if (!(amount > 0) || amount > 1_000_000) return { status: 400, body: { ok: false, error: "Couldn't read the amount." } };
  const merchant = typeof body?.merchant === "string" ? body.merchant.trim().slice(0, 120) || null : null;
  const now = deps.now();
  let at = now;
  if (typeof body?.at === "string" && body.at) {
    const parsed = new Date(body.at);
    // Shortcuts send the transaction time; ignore anything in the future or more than a week old.
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 60_000 && now.getTime() - parsed.getTime() < 7 * 86_400_000) {
      at = parsed;
    }
  }

  let userId: string;
  try {
    userId = await deps.useKey(await sha256Hex(key));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/daily limit/.test(msg)) return { status: 429, body: { ok: false, error: "That's 200 captures today. Loot will take more tomorrow." } };
    return { status: 401, body: { ok: false, error: "That capture key isn't valid. Create a new one in Loot → Settings." } };
  }

  const mKey = merchantKey(merchant);
  const currency = await deps.currency(userId);
  const logged = `${formatCurrencyExact(amount, currency)}${merchant ? ` at ${merchant}` : ""}`;
  const [hash, previous] = await dedupeHashes(userId, mKey, amount, at);
  if (await deps.hashExists(userId, [hash, previous])) return { status: 200, body: { ok: true, duplicate: true, logged } };

  const category = mKey ? await deps.merchantCategory(userId, mKey) : null;
  const inserted = await deps.insert({
    user_id: userId,
    amount,
    merchant,
    category,
    spent_at: at.toISOString(),
    source: "apple_pay",
    external_hash: hash,
  });
  if (!inserted) return { status: 200, body: { ok: true, duplicate: true, logged } };
  return { status: 200, body: { ok: true, logged, sorted: category !== null } };
}

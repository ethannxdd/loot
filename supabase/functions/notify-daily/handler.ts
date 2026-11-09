// Loot — notify-daily — the logic (no Deno / Supabase imports, so it can be unit tested). index.ts wires it up.
//
// Runs from pg_cron at 07:00 SAST ({"run":"daily"}) and Sundays 18:00 SAST ({"run":"weekly"}). For every person it
// computes the scheduled push-worthy notifications with the SAME pure modules the app uses (_shared/lib, synced from
// src/lib) and inserts them into `notifications`. dedupe_key makes re-runs harmless. It never sends — push-dispatch does.

import { cronAuthorised, flagOn, saWallClock, saWallClockIso, type Result } from "../_shared/http.ts";
import { scheduledCandidates, type Candidate } from "../_shared/lib/server-notifications.ts";
import type { SpendEntry } from "../_shared/lib/spending.ts";
import type { Expense } from "../_shared/lib/types.ts";
import type { PaydaySettings } from "../_shared/lib/cycle.ts";

export interface ProfileRow {
  id: string;
  net_income: number;
  safety_buffer_pct: number;
  currency_code: string | null;
  payday_day: number | null;
  payday_rule: string | null;
}

export interface FlagState {
  global: boolean;
  overrides: Map<string, boolean>;
}

/** Extra generators later batches plug in (stokvels, splits, wishlist, renewals, prices, challenges). */
export type ExtraGenerator = (userIds: string[], today: Date, run: "daily" | "weekly") => Promise<ExtraCandidate[]>;

/** A candidate from another batch's generator — its kind may be any notification kind. */
export type ExtraCandidate = Omit<Candidate, "kind"> & { kind: string; user_id: string };

export interface NotifyDeps {
  cronSecret: string | undefined;
  flags(keys: string[]): Promise<Record<string, FlagState>>;
  /** Profiles in pages (ordered by id). */
  profiles(offset: number, limit: number): Promise<ProfileRow[]>;
  expenses(userIds: string[]): Promise<Expense[]>;
  /** Spend entries since `sinceIso`, not deleted. */
  spendEntries(userIds: string[], sinceIso: string): Promise<SpendEntry[]>;
  insertNotifications(rows: ExtraCandidate[]): Promise<number>;
  extras?: ExtraGenerator[];
  now(): Date;
}

export const PAGE_SIZE = 500;

export async function handleNotifyDaily(cronHeader: string | null, body: { run?: unknown }, deps: NotifyDeps): Promise<Result> {
  if (!cronAuthorised(cronHeader, deps.cronSecret)) return { status: 401, body: { error: "Not allowed." } };
  const run = body?.run === "weekly" ? "weekly" : "daily";
  const now = deps.now();
  const today = saWallClock(now);
  const since = new Date(now.getTime() - 45 * 86_400_000).toISOString();
  const flags = await deps.flags(["live_cycle", "push"]);

  let offset = 0;
  let users = 0;
  let inserted = 0;
  for (;;) {
    const page = await deps.profiles(offset, PAGE_SIZE);
    if (page.length === 0) break;
    offset += page.length;
    users += page.length;

    const live = page.filter((p) => flagOn(flags.live_cycle, p.id));
    const push = new Set(page.filter((p) => flagOn(flags.push, p.id)).map((p) => p.id));
    const ids = page.filter((p) => live.includes(p) || push.has(p.id)).map((p) => p.id);
    const rows: ExtraCandidate[] = [];
    const [expenses, entries] = ids.length > 0 ? await Promise.all([deps.expenses(ids), deps.spendEntries(ids, since)]) : [[], []];
    for (const p of page) {
      const isLive = live.includes(p);
      if (!isLive && !push.has(p.id)) continue;
      const payday: PaydaySettings | null =
        isLive && p.payday_day != null ? { payday_day: p.payday_day, payday_rule: p.payday_rule ?? "previous_working_day" } : null;
      const candidates = scheduledCandidates(
        {
          net_income: Number(p.net_income) || 0,
          safety_buffer_pct: Number(p.safety_buffer_pct) || 0,
          currency_code: p.currency_code ?? "ZAR",
          payday,
          expenses: expenses.filter((e) => e.user_id === p.id).map((e) => ({ ...e, amount: Number(e.amount) })),
          entries: isLive
            ? entries.filter((e) => e.user_id === p.id).map((e) => ({ ...e, amount: Number(e.amount), spent_at: saWallClockIso(e.spent_at) }))
            : [],
        },
        today,
        run,
      ).filter((c) => {
        // Payday, pace and budgets need payday cycles (live_cycle); debit orders are a push-only kind (the bell
        // already has per-expense "upcoming debit" reminders).
        if (c.kind === "debit_orders") return push.has(p.id);
        return isLive;
      });
      for (const c of candidates) rows.push({ ...c, user_id: p.id });
    }
    // Later batches' generators check their own feature flags.
    for (const extra of deps.extras ?? []) rows.push(...(await extra(page.map((p) => p.id), today, run)));
    if (rows.length > 0) inserted += await deps.insertNotifications(rows);
    if (page.length < PAGE_SIZE) break;
  }

  return { status: 200, body: { ok: true, run, users, inserted } };
}

// Loot — push-dispatch — the logic (no Deno / Supabase imports, so it can be unit tested). index.ts wires it up.
//
// Every 5 minutes (pg_cron): pushes each notification that hasn't been pushed yet (created in the last 24h) to the
// person's devices — only kinds they've switched on, never 21:00–07:00 SAST (rows wait until 07:00), at most 3
// automatic pushes per person per SAST day (Rule 23). Expired subscriptions (404/410) are deleted; every send is
// logged in push_deliveries. B7 adds announcement delivery through `materialise`.

import { cronAuthorised, flagOn, type Result } from "../_shared/http.ts";
import { CAP_EXEMPT, DAILY_PUSH_CAP, inQuietHours, kindEnabled, sastDay } from "../_shared/lib/server-notifications.ts";
import type { FlagState } from "../notify-daily/handler.ts";

export interface PendingNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  announcement_id?: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
}

export interface PushPayload {
  title: string;
  body: string;
  link: string;
  /** push_deliveries.id — the app reports a click with mark_push_clicked. */
  d: number;
  tag: string;
}

export interface DispatchDeps {
  cronSecret: string | undefined;
  now(): Date;
  flags(keys: string[]): Promise<Record<string, FlagState>>;
  /** B7: turn due announcements into notification rows (and receipts) before sending. */
  materialise?: () => Promise<void>;
  pending(sinceIso: string, limit: number): Promise<PendingNotification[]>;
  prefs(userIds: string[]): Promise<Map<string, Record<string, unknown>>>;
  subscriptions(userIds: string[]): Promise<Subscription[]>;
  /** Automatic pushes already sent today (SAST), per user, excluding cap-exempt kinds. */
  sentToday(userIds: string[], dayStartIso: string): Promise<Map<string, number>>;
  logDelivery(row: { user_id: string; notification_id: string; kind: string; platform: string; announcement_id?: string | null }): Promise<number>;
  setDeliveryStatus(id: number, status: "sent" | "failed" | "expired"): Promise<void>;
  /** Returns the push service's HTTP status. */
  send(sub: Subscription, payload: PushPayload): Promise<number>;
  deleteSubscription(id: string): Promise<void>;
  markSubscription(id: string, ok: boolean): Promise<void>;
  markPushed(notificationIds: string[]): Promise<void>;
}

export const BATCH = 1000;

/** 00:00 SAST of the SAST day containing `at`, as an ISO instant. */
export function sastDayStartIso(at: Date): string {
  return new Date(`${sastDay(at)}T00:00:00+02:00`).toISOString();
}

export async function handlePushDispatch(cronHeader: string | null, deps: DispatchDeps): Promise<Result> {
  if (!cronAuthorised(cronHeader, deps.cronSecret)) return { status: 401, body: { error: "Not allowed." } };
  const now = deps.now();
  if (deps.materialise) await deps.materialise();
  if (inQuietHours(now)) return { status: 200, body: { ok: true, quiet: true, sent: 0 } };

  const pending = await deps.pending(new Date(now.getTime() - 24 * 3_600_000).toISOString(), BATCH);
  if (pending.length === 0) return { status: 200, body: { ok: true, sent: 0 } };

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const [flags, prefs, subs, counts] = await Promise.all([
    deps.flags(["push"]),
    deps.prefs(userIds),
    deps.subscriptions(userIds),
    deps.sentToday(userIds, sastDayStartIso(now)),
  ]);

  const subsByUser = new Map<string, Subscription[]>();
  for (const s of subs) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s]);

  let sent = 0;
  let failed = 0;
  let expired = 0;
  let skipped = 0;
  const done: string[] = [];
  const ordered = [...pending].sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const n of ordered) {
    done.push(n.id); // pushed or deliberately skipped: either way it's never retried
    const userSubs = subsByUser.get(n.user_id) ?? [];
    const exempt = CAP_EXEMPT.has(n.kind);
    const count = counts.get(n.user_id) ?? 0;
    if (
      !flagOn(flags.push, n.user_id) ||
      !kindEnabled(prefs.get(n.user_id), n.kind) ||
      userSubs.length === 0 ||
      (!exempt && count >= DAILY_PUSH_CAP)
    ) {
      skipped++;
      continue;
    }

    let anySent = false;
    for (const sub of userSubs) {
      const deliveryId = await deps.logDelivery({
        user_id: n.user_id,
        notification_id: n.id,
        kind: n.kind,
        platform: sub.platform,
        announcement_id: n.announcement_id ?? null,
      });
      let status = 0;
      try {
        status = await deps.send(sub, { title: n.title, body: n.body, link: n.link ?? '/dashboard', d: deliveryId, tag: n.kind });
      } catch {
        status = 0;
      }
      if (status >= 200 && status < 300) {
        anySent = true;
        sent++;
        await deps.markSubscription(sub.id, true);
      } else if (status === 404 || status === 410) {
        expired++;
        await deps.setDeliveryStatus(deliveryId, "expired");
        await deps.deleteSubscription(sub.id);
      } else {
        failed++;
        await deps.setDeliveryStatus(deliveryId, "failed");
        await deps.markSubscription(sub.id, false);
      }
    }
    if (anySent && !exempt) counts.set(n.user_id, count + 1);
  }

  await deps.markPushed(done);
  return { status: 200, body: { ok: true, sent, failed, expired, skipped, notifications: done.length } };
}

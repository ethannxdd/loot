// Loot — push-dispatch — Supabase Edge Function (Deno). Phase 6 B2 (+ announcements in B7).
// Called every 5 minutes by pg_cron with x-cron-secret. Sends web push for notifications not yet pushed.
//
// Deploy: npx supabase functions deploy push-dispatch --no-verify-jwt
// Secrets: CRON_SECRET, VAPID_PRIVATE_JWK (the JSON private key from `npm run vapid`), VAPID_SUBJECT (mailto:…).

import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.5";
import { json } from "../_shared/http.ts";
import { materialiseAnnouncements } from "../_shared/announcements.ts";
import { chunks, loadFlags, serviceClient } from "../_shared/supabase.ts";
import { handlePushDispatch, type PendingNotification, type Subscription } from "./handler.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const db = serviceClient();
  const privateJWK = Deno.env.get("VAPID_PRIVATE_JWK");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@loot.co.za";
  if (!privateJWK) return json({ error: "VAPID_PRIVATE_JWK is not set." }, 500);

  try {
    const result = await handlePushDispatch(req.headers.get("x-cron-secret"), {
      cronSecret: Deno.env.get("CRON_SECRET"),
      now: () => new Date(),
      flags: (keys) => loadFlags(db, keys),
      materialise: () => materialiseAnnouncements(db),
      async pending(since, limit) {
        const { data, error } = await db
          .from("notifications")
          .select("id, user_id, kind, title, body, link, created_at, announcement_id")
          .is("pushed_at", null)
          .gte("created_at", since)
          .order("created_at")
          .limit(limit);
        if (error) {
          // announcement_id arrives with Migration 032 — fall back without it.
          const retry = await db
            .from("notifications")
            .select("id, user_id, kind, title, body, link, created_at")
            .is("pushed_at", null)
            .gte("created_at", since)
            .order("created_at")
            .limit(limit);
          if (retry.error) throw retry.error;
          return (retry.data ?? []) as PendingNotification[];
        }
        return (data ?? []) as PendingNotification[];
      },
      async prefs(ids) {
        const out = new Map<string, Record<string, unknown>>();
        for (const c of chunks(ids)) {
          const { data } = await db.from("profiles").select("id, notification_prefs").in("id", c);
          for (const p of data ?? []) out.set(p.id, (p.notification_prefs ?? {}) as Record<string, unknown>);
        }
        return out;
      },
      async subscriptions(ids) {
        const out: Subscription[] = [];
        for (const c of chunks(ids)) {
          const { data } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, platform").in("user_id", c);
          out.push(...((data ?? []) as Subscription[]));
        }
        return out;
      },
      async sentToday(ids, dayStart) {
        const out = new Map<string, number>();
        for (const c of chunks(ids)) {
          const { data } = await db
            .from("push_deliveries")
            .select("user_id, notification_id, kind")
            .in("user_id", c)
            .eq("status", "sent")
            .gte("sent_at", dayStart)
            .neq("kind", "feedback_reply");
          // One notification can go to several devices — count notifications, not deliveries.
          const seen = new Set<string>();
          for (const r of data ?? []) {
            const k = `${r.user_id}:${r.notification_id}`;
            if (seen.has(k)) continue;
            seen.add(k);
            out.set(r.user_id, (out.get(r.user_id) ?? 0) + 1);
          }
        }
        return out;
      },
      async logDelivery(row) {
        const { data, error } = await db.from("push_deliveries").insert({ ...row, status: "sent" }).select("id").single();
        if (error) throw error;
        return data.id as number;
      },
      async setDeliveryStatus(id, status) {
        await db.from("push_deliveries").update({ status }).eq("id", id);
      },
      async send(sub, payload) {
        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message: { payload, adminContact: subject, options: { ttl: 12 * 3600, urgency: "normal" } },
        });
        const res = await fetch(endpoint, { method: "POST", headers, body });
        return res.status;
      },
      async deleteSubscription(id) {
        await db.from("push_subscriptions").delete().eq("id", id);
      },
      async markSubscription(id, ok) {
        if (ok) await db.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", id);
        else await db.rpc("increment_push_failure", { p_id: id }).then(() => undefined, () => undefined);
      },
      async markPushed(ids) {
        for (const c of chunks(ids, 500)) {
          await db.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", c);
        }
      },
    });
    return json(result.body, result.status);
  } catch (err) {
    console.error("push-dispatch failed", err);
    return json({ error: "push-dispatch failed" }, 500);
  }
});

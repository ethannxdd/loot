// Announcement delivery for push-dispatch (Phase 6 B7, Migration 032). Each run turns due announcements into
// receipts (banner), bell rows and push rows for their audience, and ends expired ones. The SQL function does the work
// in one transaction; push-dispatch then sends the push rows under the same quiet-hours and daily-cap rules.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function materialiseAnnouncements(db: SupabaseClient): Promise<void> {
  const { error } = await db.rpc("materialise_due_announcements");
  // Before Migration 032 the function doesn't exist — nothing to deliver.
  if (error && !/does not exist|schema cache/i.test(error.message)) console.error("materialise_due_announcements failed", error);
}

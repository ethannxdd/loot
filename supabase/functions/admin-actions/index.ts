// Loot — admin-actions — Supabase Edge Function (Deno runtime)
//
// The admin portal's account actions that need Supabase's service-role key, so they can't run in the browser:
//   confirm_email, send_password_reset, send_magic_link, sign_out_everywhere (Support and up)
//   delete_user (Owner only — the admin types the account's email to confirm)
//
// Same rules as the admin_* database functions (Migration 025): the caller must be on the admin team with
// the right role, on a two-factor (aal2) session, and every action is written to admin_audit_log.
// Everything else the portal does goes through the database functions directly.
//
// Deploy like delete-account: Supabase dashboard → Edge Functions → Deploy a new function → Via Editor →
// name it exactly `admin-actions` → paste BOTH files (index.ts and handler.ts) → Deploy, with "Verify JWT" on.
// Or with the CLI: supabase functions deploy admin-actions
// No secrets needed: Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// Request:  POST { action, user_id, reason?, confirm_email?, redirect_to? } with the admin's session token.
// Response: { ok: true, ... } or { error: string }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { aalFromToken, handleAdminAction, type ActionRequest, type AdminRole, type Deps } from "./handler.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "The server is not configured for admin actions." }, 500);
  }

  let body: ActionRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const deps: Deps = {
    async getCaller(t) {
      const { data, error } = await admin.auth.getUser(t);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null, aal: aalFromToken(t) };
    },
    async getRole(userId) {
      const { data } = await admin.from("admin_users").select("role").eq("user_id", userId).maybeSingle();
      return (data?.role as AdminRole | undefined) ?? null;
    },
    async getUser(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null, email_confirmed_at: data.user.email_confirmed_at ?? null };
    },
    async confirmEmail(userId) {
      const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) throw error;
    },
    async sendPasswordReset(email, redirectTo) {
      const { error } = await admin.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
    },
    async sendMagicLink(email, redirectTo) {
      const { error } = await admin.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
      });
      if (error) throw error;
    },
    async revokeSessions(userId) {
      const { data, error } = await admin.rpc("admin_revoke_sessions", { p_user: userId });
      if (error) throw error;
      return typeof data === "number" ? data : 0;
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    async audit(entry) {
      const { error } = await admin.from("admin_audit_log").insert(entry);
      if (error) console.error("audit insert failed", error);
    },
  };

  try {
    const result = await handleAdminAction(token, body, deps);
    return json(result.body, result.status);
  } catch (err) {
    console.error("admin-actions crashed", err);
    return json({ error: "Something went wrong. Nothing was changed." }, 500);
  }
});

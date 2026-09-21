// Loot — delete-account — Supabase Edge Function (Deno runtime)
//
// Permanently deletes the signed-in user's account and everything attached to it.
//
// Why this has to be a server function: removing a row from `auth.users` needs the service-role key, which
// must never ship in the browser bundle. The client calls this function with the user's own session token;
// the function checks who that is, then deletes exactly that user and nobody else.
//
// What gets deleted: the `auth.users` row. Every Loot table references it with `on delete cascade`
// (profiles, expenses, goals, snapshots, plans, debts, tax data, scores, notifications, statement analyses,
// assistant chats, household rows …), so removing the user removes all of their data in one step.
// If the user owns a household, that household (and its member links and pending invites) goes with them —
// a partner is simply unlinked and keeps their own account and data.
//
// Deploy with:  supabase functions deploy delete-account
// No extra secrets are needed: Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into every edge
// function automatically.
//
// Request:  POST { confirm: "DELETE" }  with the user's session in the Authorization header.
// Response: { ok: true } on success, { error: string } on failure.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "The server is not configured for account deletion." }, 500);
    }

    // Belt and braces: the client makes the user type DELETE, and the server insists on the same flag so a
    // stray request (or a bug) can never delete an account by accident.
    let body: { confirm?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    if (body.confirm !== "DELETE") {
      return json({ error: 'Missing confirmation. Send { "confirm": "DELETE" }.' }, 400);
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json({ error: "You need to be signed in." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Work out who is asking from their own token — never from anything in the request body.
    const { data, error: userError } = await admin.auth.getUser(token);
    if (userError || !data.user) {
      return json({ error: "Your session is not valid. Sign in again and retry." }, 401);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error("deleteUser failed", deleteError);
      return json({ error: "Couldn't delete the account. Nothing was changed — please try again." }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("delete-account crashed", err);
    return json({ error: "Something went wrong deleting the account. Please try again." }, 500);
  }
});

// Loot — loot-assistant (Ask Loot) — Supabase Edge Function (Deno). Reworked in Phase 6 B6.
//
// Relays a conversation to Gemini with Loot's tool declarations. Tool calls go back to the browser, which runs them
// with the person's own data and src/lib, then calls again with kind "continue". The model never computes money
// (Rule 25). Every request is counted with use_assistant_question(), using the person's own token (daily cap).
//
// Deploy: npx supabase functions deploy loot-assistant   (Verify JWT ON)
// Secrets: GEMINI_API_KEY. Turn on Gemini billing before switching the `assistant` flag on for everyone (D14).
//
// Request:  { kind: 'question' | 'continue', contents: GeminiContent[], financialContext: string }
// Response: { reply, left } | { functionCalls, modelContent, left } | { limit: true, reply } | { error }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, json } from "../_shared/http.ts";
import { GEMINI_MODEL, handleAssistant, type AssistantBody } from "./handler.ts";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!apiKey || !url || !anon) return json({ error: "Ask Loot isn’t set up on this server yet." }, 500);

  let body: AssistantBody = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  try {
    const result = await handleAssistant(req.headers.get("Authorization"), body, {
      async useQuestion(token, kind) {
        // The user's own client, so auth.uid() inside the RPC is them.
        const db = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await db.rpc("use_assistant_question", { p_kind: kind });
        if (error) throw new Error(error.message);
        return Number(data);
      },
      async gemini(payload) {
        const res = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        if (!res.ok) console.error("Gemini error", res.status, text.slice(0, 500));
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        return { ok: res.ok, status: res.status, json: parsed };
      },
    });
    return json(result.body, result.status);
  } catch (err) {
    console.error("loot-assistant crashed", err);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});

// Loot — loot-assistant — the logic (no Deno / Supabase imports, so it can be unit tested). index.ts wires it up.
//
// Phase 6 B6 (Rule 25): the function only RELAYS to Gemini with function declarations. When Gemini asks for a tool,
// the calls go back to the browser, which runs them with src/lib (the same maths as the rest of Loot) and calls again
// with the results ("continue"). The model never computes money. Each question is counted against the daily cap first.

import type { Result } from "../_shared/http.ts";
import { ASSISTANT_TOOLS } from "../_shared/lib/assistant-declarations.ts";

export const GEMINI_MODEL = "gemini-flash-latest";

export const SYSTEM_PROMPT = `You are Ask Loot, the assistant inside Loot, a South African personal finance app. Loot answers "how much can I actually spend" from the person's own numbers.

Rules:
- Every rand figure in your answer must come from a tool result in this conversation. Never calculate, estimate or invent money amounts yourself. If you need a number, call a tool. If no tool gives it, say you can't work it out.
- For "can I afford…" questions always call check_affordability and give its verdict in plain words.
- Plain South African English, short (a few sentences or a short list), no exclamation marks, no emoji. Rands as "R 1 234".
- You are not a licensed financial adviser. For legal or tax consequences, suggest checking with SARS or a professional — but answer everyday budgeting questions directly.
- You may offer ONE next step by ending your answer with exactly one marker: [[action:wishlist]] (add it to the wishlist), [[action:log]] (log a spend), [[action:planner]] (open the salary planner), [[action:checker]] (run a full check) or [[action:tools]] (open the calculators). Only when it genuinely helps.

The person's numbers (headline figures only):
{{CONTEXT}}`;

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface AssistantBody {
  kind?: unknown;
  contents?: unknown;
  financialContext?: unknown;
}

export interface AssistantDeps {
  /** Counts the request with the user's own token. Throws Error('daily limit reached') at the cap. */
  useQuestion(token: string, kind: "question" | "continue"): Promise<number>;
  gemini(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; json: unknown }>;
}

export const LIMIT_REPLY = "That’s it for today — you’ve used all your Ask Loot questions. They reset at midnight.";

const MAX_CONTENTS = 40;
const MAX_BYTES = 60_000;

/** Only the shapes Gemini needs; anything else in a part is dropped. */
export function sanitiseContents(raw: unknown): GeminiContent[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CONTENTS) return null;
  if (JSON.stringify(raw).length > MAX_BYTES) return null;
  const out: GeminiContent[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") return null;
    const role = (c as { role?: unknown }).role;
    const parts = (c as { parts?: unknown }).parts;
    if ((role !== "user" && role !== "model") || !Array.isArray(parts) || parts.length === 0) return null;
    const clean: GeminiPart[] = [];
    for (const p of parts as Record<string, unknown>[]) {
      if (typeof p?.text === "string") clean.push({ text: p.text.slice(0, 4000), ...(typeof p.thoughtSignature === "string" ? { thoughtSignature: p.thoughtSignature } : {}) });
      else if (p?.functionCall && typeof (p.functionCall as { name?: unknown }).name === "string") {
        clean.push({ functionCall: p.functionCall as GeminiPart["functionCall"], ...(typeof p.thoughtSignature === "string" ? { thoughtSignature: p.thoughtSignature } : {}) });
      } else if (p?.functionResponse && typeof (p.functionResponse as { name?: unknown }).name === "string") {
        clean.push({ functionResponse: p.functionResponse as GeminiPart["functionResponse"] });
      }
    }
    if (clean.length === 0) return null;
    out.push({ role, parts: clean });
  }
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

export async function handleAssistant(authHeader: string | null, body: AssistantBody, deps: AssistantDeps): Promise<Result> {
  const token = (authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { status: 401, body: { error: "Sign in to use Ask Loot." } };
  const kind = body?.kind === "continue" ? "continue" : "question";
  const contents = sanitiseContents(body?.contents);
  if (!contents) return { status: 400, body: { error: "That conversation is too long or malformed. Start a new one." } };
  const context = typeof body?.financialContext === "string" ? body.financialContext.slice(0, 6000) : "";

  let left: number;
  try {
    left = await deps.useQuestion(token, kind);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/daily limit/.test(msg)) return { status: 200, body: { limit: true, reply: LIMIT_REPLY } };
    if (/suspended/.test(msg)) return { status: 403, body: { error: "Your account is read-only right now." } };
    return { status: 401, body: { error: "Sign in to use Ask Loot." } };
  }

  const res = await deps.gemini({
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT.replace("{{CONTEXT}}", context || "(no numbers yet)") }] },
    tools: [{ functionDeclarations: ASSISTANT_TOOLS }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });
  if (!res.ok) return { status: 502, body: { error: "Ask Loot couldn’t reach Gemini. Try again in a moment." } };

  const candidate = (res.json as { candidates?: { content?: GeminiContent }[] })?.candidates?.[0]?.content;
  const parts = candidate?.parts ?? [];
  const calls = parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
  if (calls.length > 0) return { status: 200, body: { functionCalls: calls, modelContent: { role: "model", parts }, left } };
  const reply = parts.map((p) => p.text ?? "").join("").trim();
  if (!reply) return { status: 502, body: { error: "Ask Loot didn’t come back with an answer. Try asking another way." } };
  return { status: 200, body: { reply, left } };
}

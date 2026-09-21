// Loot Assistant — Supabase Edge Function (Deno runtime)
//
// Proxies chat messages to the Gemini API so the API key never reaches the client.
// Deploy with: supabase functions deploy loot-assistant
// Then set the secret: supabase secrets set GEMINI_API_KEY=your-key-here
//
// Request body:
//   {
//     message: string                                   — the user's new message
//     history: { role: 'user' | 'assistant', content: string }[]  — prior turns, oldest first
//     financialContext: string                          — a compact plain-text summary of the
//                                                          user's own numbers (disposable income,
//                                                          savings rate, top expenses, debts,
//                                                          goals, tax profile) assembled client-side.
//                                                          Never raw bank transactions — see
//                                                          Business Rule 13 in LOOT-FEATURES.md.
//   }
//
// Response body: { reply: string } on success, { error: string } on failure.

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are the Loot Assistant, a friendly and knowledgeable personal finance helper inside Loot, a South African personal finance app. Loot's whole purpose is answering "how much money do you actually have left this month" — disposable income after every commitment.

Ground every answer in the user's own numbers when they're given below — don't make up figures. Speak plainly, keep answers concise (a few short paragraphs at most, use lists sparingly), and default to South African context: Rands (R), SARS tax rules, local banks (FNB, Capitec), and SA cost-of-living norms. You are not a licensed financial advisor — for anything with real legal or tax consequences, suggest the user verify with a professional or SARS eFiling, but don't be overly cautious about everyday budgeting questions.

The user's current financial snapshot:
{{CONTEXT}}

If the snapshot above is empty or a question falls outside it, answer from general South African personal finance knowledge instead of refusing.`;

interface AssistantRequest {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  financialContext: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured on this Supabase project.",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as AssistantRequest;
    if (!body.message || typeof body.message !== "string") {
      return new Response(
        JSON.stringify({ error: 'Missing "message" in request body.' }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const contents = [
      ...history.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
      { role: "user", parts: [{ text: body.message }] },
    ];

    const systemInstruction = {
      parts: [
        {
          text: SYSTEM_PROMPT.replace(
            "{{CONTEXT}}",
            body.financialContext || "(no financial data available yet)",
          ),
        },
      ],
    };

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const data = await geminiResponse.json();
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    if (!reply) {
      return new Response(
        JSON.stringify({ error: "Gemini returned an empty response." }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});

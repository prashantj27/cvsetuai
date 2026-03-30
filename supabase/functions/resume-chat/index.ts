import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ── Rate limiter ─────────────────────────────────────────────── */
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || now > b.resetAt) { ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return false; }
  return ++b.count > RATE_LIMIT;
}

setInterval(() => { const now = Date.now(); for (const [k, v] of ipBuckets) if (now > v.resetAt) ipBuckets.delete(k); }, 300_000);

/* ── Retry wrapper ────────────────────────────────────────────── */
async function fetchWithRetry(url: string, body: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && i < retries) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i) + Math.random() * 500));
      continue;
    }
    return res;
  }
  throw new Error("Gemini unreachable after retries");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "10" },
    });
  }

  try {
    const { messages, systemPrompt } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const geminiContents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I will follow these instructions." }] },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }))
    ];

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      JSON.stringify({
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
      })
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown');
      console.error(`[resume-chat] Gemini error: ${response.status}`, errBody.slice(0, 300));
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini error ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[resume-chat] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

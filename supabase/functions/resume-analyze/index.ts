import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ── Simple in-memory rate limiter (per-instance) ─────────────── */
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT = 30;         // max 30 requests per IP per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT;
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of ipBuckets) {
    if (now > b.resetAt) ipBuckets.delete(ip);
  }
}, 300_000);

/* ── Retry wrapper for Gemini API ─────────────────────────────── */
async function fetchGeminiWithRetry(url: string, body: string, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) return res;
    if (res.status === 429 && attempt < retries) {
      const delay = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`[resume-analyze] Gemini 429 — retry ${attempt + 1} in ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
      continue;
    }
    return res; // non-retryable error
  }
  throw new Error("Gemini API unreachable after retries");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "10" },
    });
  }

  try {
    const { prompt, maxTokens = 8192, imageBase64, systemPrompt } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    console.log(`[resume-analyze] prompt:${prompt?.length} maxTokens:${maxTokens} hasImage:${!!imageBase64}`);

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
    }
    
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}`
      : `You are an elite ATS algorithm and McKinsey/Google senior recruiter. You MUST return ONLY valid JSON. No markdown code fences, no backticks, no commentary, no explanation — output MUST start with { and end with }. This is critical.\n\n${prompt}`;
    
    parts.push({ text: fullPrompt });

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_GEMINI_API_KEY}`;
    const bodyStr = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: Math.min(maxTokens, 65536),
        temperature: 0.7,
      },
    });

    const response = await fetchGeminiWithRetry(apiUrl, bodyStr);

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown');
      console.error(`[resume-analyze] Gemini API error: ${response.status}`, errBody.slice(0, 500));

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "15" },
        });
      }
      throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = data.candidates?.[0]?.finishReason;

    console.log(`[resume-analyze] Response len:${text.length} finishReason:${finishReason}`);

    if (!text) {
      throw new Error("Empty response from AI. Please try again.");
    }

    return new Response(JSON.stringify({ text, finishReason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[resume-analyze] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

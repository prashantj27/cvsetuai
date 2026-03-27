import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, maxTokens = 8192, imageBase64, systemPrompt } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    console.log(`[resume-analyze] Sending request, prompt length: ${prompt?.length}, maxTokens: ${maxTokens}, hasImage: ${!!imageBase64}`);

    // Build parts array — supports text-only and image+text
    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }
    
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}`
      : `You are an elite ATS algorithm and McKinsey/Google senior recruiter. You MUST return ONLY valid JSON. No markdown code fences, no backticks, no commentary, no explanation — output MUST start with { and end with }. This is critical.\n\n${prompt}`;
    
    parts.push({ text: fullPrompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            maxOutputTokens: Math.min(maxTokens, 16384),
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown');
      console.error(`[resume-analyze] Gemini API error: ${response.status}`, errBody.slice(0, 500));

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = data.candidates?.[0]?.finishReason;

    console.log(`[resume-analyze] Response received. Length: ${text.length}, finishReason: ${finishReason}`);

    if (!text) {
      console.error("[resume-analyze] Empty response from Gemini");
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

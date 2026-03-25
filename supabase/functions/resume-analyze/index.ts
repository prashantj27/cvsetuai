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
    const { prompt, maxTokens = 8192 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log(`[resume-analyze] Sending request, prompt length: ${prompt?.length}, maxTokens: ${maxTokens}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an elite ATS algorithm and McKinsey/Google senior recruiter. You MUST return ONLY valid JSON. No markdown code fences, no backticks, no commentary, no explanation — output MUST start with { and end with }. This is critical."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: Math.min(maxTokens, 16384),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown');
      console.error(`[resume-analyze] AI gateway error: ${response.status}`, errBody.slice(0, 500));
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const finishReason = data.choices?.[0]?.finish_reason;
    
    console.log(`[resume-analyze] Response received. Length: ${text.length}, finishReason: ${finishReason}`);

    if (!text) {
      console.error("[resume-analyze] Empty response from AI");
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

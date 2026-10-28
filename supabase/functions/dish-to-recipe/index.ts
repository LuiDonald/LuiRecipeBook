// Supabase Edge Function: dish-to-recipe
//
// Reverse-engineers a cooking recipe from one or more PHOTOS of a finished dish
// plus an optional free-text description from the cook. Uses OpenAI's vision
// model (gpt-4o) to combine what it sees with the provided context.
//
// The OpenAI key stays server-side; only the signed-in OWNER may call this, so
// random visitors can't burn your OpenAI credits.
//
// Secrets (shared with parse-recipe; Dashboard > Edge Functions > Secrets):
//   OPENAI_API_KEY = sk-...
//   OWNER_EMAIL    = donaldtlui@gmail.com   (optional but recommended)
//   OPENAI_MODEL   = gpt-4o                 (optional; must be vision-capable)
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY
//
// Deploy:
//   supabase functions deploy dish-to-recipe --project-ref <ref>

import { createClient } from "jsr:@supabase/supabase-js@2";

const CATEGORIES = [
  "Chicken",
  "Beef",
  "Pork",
  "Lamb",
  "Seafood",
  "Egg",
  "Vegetable",
  "Soup",
  "Rice Bowl / Ramen / Noodle",
  "Dessert",
  "Drink",
];

const MAX_IMAGES = 6;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a professional chef who reverse-engineers recipes. You are given one or more PHOTOS of a finished dish and, optionally, notes from the cook (what it is, ingredients they remember, cuisine, taste, etc.).

Combine careful visual analysis of the photos WITH the cook's notes to infer the single most likely recipe to recreate the dish. The notes are strong hints — trust explicit facts in them (e.g. a named dish or listed ingredients) over guesses from the image, but use the image to fill in everything the notes omit (components, garnishes, cooking method, approximate quantities).

Return ONLY a JSON object with EXACTLY these keys:
{
  "title": string,
  "description": string,
  "ingredients": string[],
  "steps": string[],
  "tags": string[],
  "category": string
}

Rules:
- "title": a short, clean, specific dish name (e.g. "Pan-Seared Salmon with Lemon Butter").
- "description": one or two sentences. Make clear it is an approximate, reverse-engineered recipe based on the photo.
- "ingredients": one per item, with reasonable estimated quantities (e.g. "2 salmon fillets", "3 tbsp butter"). Infer sensible amounts for a typical serving.
- "steps": discrete, ordered, cookable instructions. No leading numbers or bullets.
- "tags": a few lowercase keywords (cuisine, method, meal type).
- "category": the single best fit from this list, or "" if unclear: ${CATEGORIES.join(", ")}.
- If the cook's notes are in another language, you MAY write the recipe in that language; otherwise default to English.
- If the photos clearly do NOT show food/a dish, return the shape with empty string/array values.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // --- Auth: require the signed-in owner ---
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ownerEmail = (Deno.env.get("OWNER_EMAIL") ?? "").toLowerCase().trim();
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return json({ error: "Not signed in" }, 401);
  const email = (user.email ?? "").toLowerCase();
  if (ownerEmail && email !== ownerEmail) {
    return json({ error: "Not authorized" }, 403);
  }

  // --- Input ---
  let images: unknown;
  let description = "";
  try {
    const body = await req.json();
    images = body?.images;
    description = (body?.description ?? "").toString().trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(images) || images.length === 0) {
    return json({ error: "Provide at least one image" }, 400);
  }
  const imageUrls = images
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, MAX_IMAGES);
  if (imageUrls.length === 0) {
    return json({ error: "No valid images provided" }, 400);
  }
  // Accept only data: URLs or http(s) URLs (what the vision API supports).
  for (const u of imageUrls) {
    if (!/^data:image\/|^https?:\/\//i.test(u)) {
      return json({ error: "Images must be data: URLs or http(s) URLs" }, 400);
    }
  }
  if (description.length > 4000) description = description.slice(0, 4000);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

  // --- Build the multimodal user message ---
  const userContent: Record<string, unknown>[] = [
    {
      type: "text",
      text: description
        ? `The cook's notes about this dish:\n${description}`
        : "No notes were provided — infer everything from the photo(s).",
    },
    ...imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url, detail: "auto" },
    })),
  ];

  // --- OpenAI ---
  let aiRes: Response;
  try {
    aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (e) {
    return json({ error: `OpenAI request failed: ${e}` }, 502);
  }

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: `OpenAI error ${aiRes.status}`, detail }, 502);
  }

  const payload = await aiRes.json();
  const content = payload?.choices?.[0]?.message?.content ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "Model did not return valid JSON" }, 502);
  }

  // --- Normalize / harden the shape ---
  const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const asArr = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === "string" ? x.trim() : String(x))).filter(Boolean)
      : [];

  const rawCategory = asStr(parsed.category);
  const category =
    CATEGORIES.find((c) => c.toLowerCase() === rawCategory.toLowerCase()) ?? "";

  return json({
    recipe: {
      title: asStr(parsed.title),
      description: asStr(parsed.description),
      ingredients: asArr(parsed.ingredients),
      steps: asArr(parsed.steps),
      tags: asArr(parsed.tags).map((t) => t.toLowerCase()),
      category,
    },
  });
});

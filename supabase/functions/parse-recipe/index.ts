// Supabase Edge Function: parse-recipe
//
// Takes pasted free-form recipe text (or a social-media caption) and uses
// OpenAI to return a structured recipe as JSON. The OpenAI key stays server-side
// here — it is never shipped in the app bundle.
//
// Security: only the signed-in OWNER may call this (checked below), so random
// visitors can't burn your OpenAI credits.
//
// Secrets to set (Supabase Dashboard > Edge Functions > parse-recipe > Secrets,
// or `supabase secrets set`):
//   OPENAI_API_KEY = sk-...
//   OWNER_EMAIL    = donaldtlui@gmail.com   (optional but recommended)
//   OPENAI_MODEL   = gpt-4o                 (optional; swap models w/o redeploy)
//
// Deploy:
//   Dashboard: create a function named "parse-recipe" and paste this file, OR
//   CLI:       supabase functions deploy parse-recipe

import { createClient } from "jsr:@supabase/supabase-js@2";

const CATEGORIES = [
  "Chicken",
  "Beef",
  "Pork",
  "Lamb",
  "Seafood",
  "Egg",
  "Veggie",
  "Soup",
  "Rice Bowl / Ramen / Noodle",
  "Dessert",
  "Drink",
];

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

const SYSTEM_PROMPT = `You extract a single cooking recipe from the user's text, which may be a pasted recipe, rough notes, or a social-media (e.g. Instagram) caption.

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
- "title": a short, clean recipe name.
- "description": one or two sentences of context, or "" if there is nothing useful.
- "ingredients": one ingredient per array item, keep quantities (e.g. "2 cups flour"). [] if none found.
- "steps": discrete, ordered instructions. Do NOT include leading numbers or bullets. [] if none found.
- "tags": a few lowercase keywords (cuisine, meal type, technique). [] if unsure.
- "category": choose the single best fit from this list, or "" if unclear: ${CATEGORIES.join(", ")}.
- PRESERVE the original language(s) of the content. Do NOT translate. If the text mixes languages (e.g. Chinese + English), keep it as written.
- Keep each quantity attached to its ingredient on the same line (e.g. "3 tbsp butter", not "3 tbsp" and "butter" separately). Preserve loose amounts like "a squeeze of lemon".
- Strip hashtags, @mentions, emojis used as spam, "follow for more", links, and other promotional filler.
- If the input is clearly NOT a recipe, return the shape with empty string/array values.`;

// A couple of worked examples so the model learns the exact style we want:
// clean quantities, stripped caption spam, and preserved bilingual text.
const FEWSHOT: { role: "user" | "assistant"; content: string }[] = [
  {
    role: "user",
    content:
      "OMG you NEED to try this 🔥🔥 Garlic Butter Shrimp!! 😍 #seafood #easydinner\n\nGrab: half a pound of shrimp, 3 tbsp butter, 4 garlic cloves, a squeeze of lemon, salt + parsley.\n\nMelt the butter, toss in garlic for like 30 sec, add shrimp 2 min each side, finish w/ lemon + parsley. Follow for more 👉",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      title: "Garlic Butter Shrimp",
      description: "Quick garlic butter shrimp finished with lemon and parsley.",
      ingredients: [
        "1/2 lb shrimp",
        "3 tbsp butter",
        "4 garlic cloves, minced",
        "A squeeze of lemon",
        "Salt",
        "Parsley",
      ],
      steps: [
        "Melt the butter in a pan.",
        "Add the garlic and cook about 30 seconds.",
        "Add the shrimp and cook 2 minutes per side.",
        "Finish with lemon juice and parsley.",
      ],
      tags: ["seafood", "easy dinner"],
      category: "Seafood",
    }),
  },
  {
    role: "user",
    content:
      "可樂雞翼 Coca-Cola Chicken Wings\n材料：雞翼10隻、可樂1罐、薑、蔥、豉油2湯匙\n做法：雞翼煎香，落薑蔥爆香，加可樂同豉油煮10分鐘收汁。",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      title: "可樂雞翼 (Coca-Cola Chicken Wings)",
      description: "",
      ingredients: [
        "雞翼 10隻",
        "可樂 1罐",
        "薑",
        "蔥",
        "豉油 2湯匙",
      ],
      steps: [
        "雞翼煎香。",
        "落薑、蔥爆香。",
        "加可樂同豉油，煮10分鐘收汁。",
      ],
      tags: ["chicken"],
      category: "Chicken",
    }),
  },
];

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

  if (userErr || !user) {
    return json({ error: "Not signed in" }, 401);
  }
  const email = (user.email ?? "").toLowerCase();
  if (ownerEmail && email !== ownerEmail) {
    return json({ error: "Not authorized" }, 403);
  }

  // --- Input ---
  let text = "";
  try {
    const body = await req.json();
    text = (body?.text ?? "").toString();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  text = text.trim();
  if (!text) return json({ error: "No text provided" }, 400);
  if (text.length > 12000) text = text.slice(0, 12000);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);

  // Model is swappable via the OPENAI_MODEL secret (no code redeploy needed).
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...FEWSHOT,
          { role: "user", content: text },
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
  const category = CATEGORIES.find(
    (c) => c.toLowerCase() === rawCategory.toLowerCase()
  ) ?? "";

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

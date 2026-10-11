// Supabase Edge Function: agent-api
//
// A small, bearer-token-protected HTTP API that lets an AI assistant help with
// meal planning and recipe refinement. It talks to the existing `recipes` table
// and the `recipe_notes` table (see supabase/recipe_notes.sql).
//
// IMPORTANT — deploy with JWT verification OFF, because we authenticate with our
// own AGENT_API_TOKEN (a bearer token) rather than a Supabase user JWT:
//   supabase functions deploy agent-api --no-verify-jwt --project-ref <ref>
//
// Secrets (Dashboard > Edge Functions > Secrets, or `supabase secrets set`):
//   AGENT_API_TOKEN = <a long random string the client sends as the bearer>
// Auto-injected by Supabase (do NOT set these yourself):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// The service_role key stays server-side and is never returned to clients.
//
// Routes (all under /functions/v1/agent-api):
//   GET   /recipes?q=&category=&tags=&limit=&offset=   list / search (paginated)
//   GET   /recipes/:id                                 full detail + notes
//   PATCH /recipes/:id                                 update recipe fields
//   POST  /recipes/:id/notes                           append a cooking note
//   POST  /recipes                                     create a recipe

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENT_TOKEN = Deno.env.get("AGENT_API_TOKEN") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ---- shaping DB rows into clean API JSON (never leak internal-only fields) ----

function recipeSummary(r: Record<string, any>) {
  const d = (r.description ?? "") as string;
  return {
    id: r.id,
    title: r.title,
    category: r.category ?? "",
    photoUrl: r.photo_url ?? null,
    tags: r.tags ?? [],
    description: d.length > 200 ? d.slice(0, 199) + "…" : d,
    deletedAt: r.deleted_at ?? null,
  };
}

function recipeDetail(r: Record<string, any>, notes: Record<string, any>[]) {
  const publicNotes = notes.map(notePublic);
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    category: r.category ?? "",
    photoUrl: r.photo_url ?? null,
    photos: r.photo_url ? [r.photo_url] : [],
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    tags: r.tags ?? [],
    notes: publicNotes,
    refinementHistory: publicNotes, // notes ARE the refinement history
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? null,
    deleteReason: r.delete_reason ?? null,
  };
}

function notePublic(n: Record<string, any>) {
  return {
    id: n.id,
    recipeId: n.recipe_id,
    text: n.text,
    author: n.author,
    createdAt: n.created_at,
  };
}

// ---- validation helpers ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class BadRequest extends Error {}

/** Coerce a value to a string[] (or undefined if not provided). Throws on bad type. */
function optStringArray(v: unknown, field: string): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new BadRequest(`"${field}" must be an array of strings`);
  return v.map((x) => String(x)).map((s) => s.trim()).filter((s) => s.length > 0);
}

function optString(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new BadRequest(`"${field}" must be a string`);
  return v;
}

async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b;
    throw new Error();
  } catch {
    throw new BadRequest("Body must be a JSON object");
  }
}

async function fetchNotes(recipeId: string) {
  const { data, error } = await db
    .from("recipe_notes")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---- endpoint handlers ----

async function listRecipes(url: URL): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const tagsParam = (url.searchParams.get("tags") ?? "").trim();
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
    100
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const onlyDeleted = url.searchParams.get("onlyDeleted") === "true";

  let query = db
    .from("recipes")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  // Hide soft-deleted recipes unless the caller explicitly asks for them.
  if (onlyDeleted) query = query.not("deleted_at", "is", null);
  else if (!includeDeleted) query = query.is("deleted_at", null);

  if (q) {
    // Strip characters that would break the PostgREST or() filter grammar.
    const safe = q.replace(/[,()*:]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.*${safe}*,description.ilike.*${safe}*`);
  }
  if (category) query = query.eq("category", category);
  if (tagsParam) {
    const tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length) query = query.contains("tags", tags);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  return json({
    data: (data ?? []).map(recipeSummary),
    pagination: { limit, offset, total: count ?? null },
  });
}

async function getRecipe(id: string): Promise<Response> {
  if (!UUID_RE.test(id)) throw new BadRequest("Invalid recipe id");
  const { data, error } = await db
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "Recipe not found" }, 404);
  const notes = await fetchNotes(id);
  return json(recipeDetail(data, notes));
}

async function patchRecipe(id: string, req: Request): Promise<Response> {
  if (!UUID_RE.test(id)) throw new BadRequest("Invalid recipe id");
  const body = await readJson(req);

  if ("notes" in body) {
    throw new BadRequest(
      "Notes are append-only — use POST /recipes/:id/notes instead of PATCH"
    );
  }

  const update: Record<string, any> = {};
  const title = optString(body.title, "title");
  if (title !== undefined) {
    if (!title.trim()) throw new BadRequest('"title" cannot be empty');
    update.title = title.trim();
  }
  const description = optString(body.description, "description");
  if (description !== undefined) update.description = description;
  const category = optString(body.category, "category");
  if (category !== undefined) update.category = category;
  // Accept photoUrl (preferred) or photo_url.
  const photo = optString(body.photoUrl ?? body.photo_url, "photoUrl");
  if (photo !== undefined) update.photo_url = photo;
  const ingredients = optStringArray(body.ingredients, "ingredients");
  if (ingredients !== undefined) update.ingredients = ingredients;
  const steps = optStringArray(body.steps, "steps");
  if (steps !== undefined) update.steps = steps;
  const tags = optStringArray(body.tags, "tags");
  if (tags !== undefined) update.tags = tags;

  if (Object.keys(update).length === 0) {
    throw new BadRequest(
      "No updatable fields provided (title, description, category, photoUrl, ingredients, steps, tags)"
    );
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from("recipes")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "Recipe not found" }, 404);

  const notes = await fetchNotes(id);
  return json(recipeDetail(data, notes));
}

async function addNote(id: string, req: Request): Promise<Response> {
  if (!UUID_RE.test(id)) throw new BadRequest("Invalid recipe id");
  const body = await readJson(req);
  const text = optString(body.text, "text");
  if (!text || !text.trim()) throw new BadRequest('"text" is required');
  const author = (optString(body.author, "author") ?? "agent").trim() || "agent";

  // Ensure the recipe exists (FK would also enforce this, but a 404 is clearer).
  const { data: recipe, error: findErr } = await db
    .from("recipes")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!recipe) return json({ error: "Recipe not found" }, 404);

  const { data, error } = await db
    .from("recipe_notes")
    .insert({ recipe_id: id, text: text.trim(), author })
    .select("*")
    .single();
  if (error) throw error;
  return json(notePublic(data), 201);
}

async function createRecipe(req: Request): Promise<Response> {
  const body = await readJson(req);
  const title = optString(body.title, "title");
  if (!title || !title.trim()) throw new BadRequest('"title" is required');

  const row = {
    title: title.trim(),
    description: optString(body.description, "description") ?? "",
    category: optString(body.category, "category") ?? "",
    photo_url: optString(body.photoUrl ?? body.photo_url, "photoUrl") ?? null,
    ingredients: optStringArray(body.ingredients, "ingredients") ?? [],
    steps: optStringArray(body.steps, "steps") ?? [],
    tags: optStringArray(body.tags, "tags") ?? [],
  };

  const { data, error } = await db.from("recipes").insert(row).select("*").single();
  if (error) throw error;
  return json(recipeDetail(data, []), 201);
}

async function softDeleteRecipe(id: string, req: Request): Promise<Response> {
  if (!UUID_RE.test(id)) throw new BadRequest("Invalid recipe id");

  // Reason may come from a JSON body or a ?reason= query param (both optional).
  let reason: string | undefined;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = await req.json();
      if (body && typeof body === "object") reason = optString(body.reason, "reason");
    } catch {
      // ignore empty/invalid body — reason is optional
    }
  }
  if (reason === undefined) {
    reason = new URL(req.url).searchParams.get("reason") ?? undefined;
  }

  const { data, error } = await db
    .from("recipes")
    .update({
      deleted_at: new Date().toISOString(),
      delete_reason: reason?.trim() || null,
    })
    .eq("id", id)
    .is("deleted_at", null) // don't clobber an existing delete timestamp
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Either the recipe doesn't exist, or it's already deleted.
    const { data: existing } = await db
      .from("recipes")
      .select("id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return json({ error: "Recipe not found" }, 404);
    return json({ id, deleted: true, alreadyDeleted: true });
  }
  return json({
    id: data.id,
    deleted: true,
    deletedAt: data.deleted_at,
    deleteReason: data.delete_reason,
  });
}

async function restoreRecipe(id: string): Promise<Response> {
  if (!UUID_RE.test(id)) throw new BadRequest("Invalid recipe id");
  const { data, error } = await db
    .from("recipes")
    .update({ deleted_at: null, delete_reason: null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "Recipe not found" }, 404);
  const notes = await fetchNotes(id);
  return json(recipeDetail(data, notes));
}

async function deleteNote(recipeId: string, noteId: string): Promise<Response> {
  if (!UUID_RE.test(recipeId)) throw new BadRequest("Invalid recipe id");
  if (!UUID_RE.test(noteId)) throw new BadRequest("Invalid note id");
  const { data, error } = await db
    .from("recipe_notes")
    .delete()
    .eq("id", noteId)
    .eq("recipe_id", recipeId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) return json({ error: "Note not found" }, 404);
  return json({ id: noteId, deleted: true });
}

// ---- router ----

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Config sanity.
  if (!SERVICE_KEY || !SUPABASE_URL) {
    return json({ error: "Server not configured (service role key missing)" }, 500);
  }
  if (!AGENT_TOKEN) {
    return json({ error: "Server not configured (AGENT_API_TOKEN not set)" }, 500);
  }

  // Bearer auth.
  const authz = req.headers.get("Authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token || token !== AGENT_TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  // Path after the function name, e.g. "/recipes/<id>/notes".
  const path = url.pathname.replace(/^.*\/agent-api/, "");
  const seg = path.split("/").filter(Boolean); // ["recipes", id?, "notes"?]

  try {
    if (seg[0] !== "recipes") {
      return json({ error: "Not found" }, 404);
    }

    // /recipes
    if (seg.length === 1) {
      if (req.method === "GET") return await listRecipes(url);
      if (req.method === "POST") return await createRecipe(req);
      return json({ error: "Method not allowed" }, 405);
    }

    // /recipes/:id
    if (seg.length === 2) {
      const id = seg[1];
      if (req.method === "GET") return await getRecipe(id);
      if (req.method === "PATCH") return await patchRecipe(id, req);
      if (req.method === "DELETE") return await softDeleteRecipe(id, req);
      return json({ error: "Method not allowed" }, 405);
    }

    // /recipes/:id/notes  and  /recipes/:id/restore
    if (seg.length === 3) {
      const id = seg[1];
      if (seg[2] === "notes") {
        if (req.method === "POST") return await addNote(id, req);
        return json({ error: "Method not allowed" }, 405);
      }
      if (seg[2] === "restore") {
        if (req.method === "POST") return await restoreRecipe(id);
        return json({ error: "Method not allowed" }, 405);
      }
      return json({ error: "Not found" }, 404);
    }

    // /recipes/:id/notes/:noteId
    if (seg.length === 4 && seg[2] === "notes") {
      const id = seg[1];
      const noteId = seg[3];
      if (req.method === "DELETE") return await deleteNote(id, noteId);
      return json({ error: "Method not allowed" }, 405);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message }, 400);
    console.error("agent-api error:", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return json({ error: message }, 500);
  }
});

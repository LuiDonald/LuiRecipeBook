// Applies transcribed recipe content (ingredients + steps) to existing Supabase
// recipes, matching by title + category. Also deletes any rows listed in
// `delete` (e.g. duplicate continuation pages that were merged).
//
// Usage: node scripts/apply_parsed.mjs scripts/parsed/<Category>.json

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply_parsed.mjs <parsed.json>");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const { category, recipes = [], delete: toDelete = [] } = data;

async function patchRecipe(title, body) {
  const url = `${SUPABASE_URL}/rest/v1/recipes?category=eq.${encodeURIComponent(
    category
  )}&title=eq.${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`patch ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows.length;
}

async function deleteRecipe(title) {
  const url = `${SUPABASE_URL}/rest/v1/recipes?category=eq.${encodeURIComponent(
    category
  )}&title=eq.${encodeURIComponent(title)}`;
  const res = await fetch(url, { method: "DELETE", headers: authHeaders });
  if (!res.ok) throw new Error(`delete ${res.status} ${await res.text()}`);
}

let updated = 0;
let missing = 0;

console.log(`\nApplying transcriptions for "${category}"\n`);

for (const r of recipes) {
  try {
    const body = {
      ingredients: r.ingredients ?? [],
      steps: r.steps ?? [],
    };
    // Optionally repoint the photo (e.g. when the "real" recipe page lives on a
    // continuation image and the first page is blank).
    if (r.photo) body.photo_url = r.photo;
    if (typeof r.description === "string") body.description = r.description;
    const n = await patchRecipe(r.title, body);
    if (n === 0) {
      console.log(`⚠  no match: ${r.title}`);
      missing++;
    } else {
      console.log(`✓  ${r.title} (${(r.ingredients ?? []).length} ingr, ${(r.steps ?? []).length} steps)`);
      updated++;
    }
  } catch (e) {
    console.log(`✗  ${r.title} — ${e.message}`);
  }
}

for (const title of toDelete) {
  try {
    await deleteRecipe(title);
    console.log(`🗑  deleted (merged): ${title}`);
  } catch (e) {
    console.log(`✗  delete ${title} — ${e.message}`);
  }
}

console.log(`\nDone: ${updated} updated, ${missing} unmatched.\n`);

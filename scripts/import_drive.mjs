// One-time Google Drive -> Supabase recipe importer.
//
// Because the Drive folder is shared publicly ("anyone with the link"), this
// script needs no Google OAuth. It reads each recipe item straight from the
// public share:
//   - image files (.HEIC etc.)  -> download, convert to JPEG (sips), upload to
//                                   Supabase Storage, set as the recipe photo
//   - Google Docs               -> export as plain text, keep as-is (each
//                                   non-empty line becomes a step)
//
// Recipe category = the Drive folder it came from.
//
// Usage:
//   node scripts/import_drive.mjs <CategoryName>
// The inventory for each category is defined in scripts/drive_inventory.json.
//
// NOTE: must run OUTSIDE the sandbox (needs network, filesystem, and `sips`).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

// ---- config ----
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INVENTORY = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts", "drive_inventory.json"), "utf8")
);

// Parse the app's .env for Supabase credentials.
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
const BUCKET = "recipe-photos";

if (!SUPABASE_URL || !KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const category = process.argv[2];
if (!category || !INVENTORY[category]) {
  console.error(
    `Usage: node scripts/import_drive.mjs <Category>\nAvailable: ${Object.keys(
      INVENTORY
    ).join(", ")}`
  );
  process.exit(1);
}

// ---- helpers ----
const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function existingTitles(cat) {
  const url = `${SUPABASE_URL}/rest/v1/recipes?select=title&category=eq.${encodeURIComponent(
    cat
  )}`;
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) throw new Error(`fetch existing ${res.status}`);
  const rows = await res.json();
  return new Set(rows.map((r) => r.title));
}

async function downloadFile(id, dest) {
  const res = await fetch(
    `https://drive.google.com/uc?export=download&id=${id}`,
    { redirect: "follow" }
  );
  const buf = Buffer.from(await res.arrayBuffer());
  // Detect the HTML interstitial Google sometimes returns.
  const head = buf.subarray(0, 64).toString("utf8").toLowerCase();
  if (head.includes("<!doctype") || head.includes("<html")) {
    throw new Error("got HTML interstitial instead of file");
  }
  fs.writeFileSync(dest, buf);
  return buf;
}

async function docText(id) {
  const res = await fetch(
    `https://docs.google.com/document/d/${id}/export?format=txt`
  );
  if (!res.ok) throw new Error(`doc export ${res.status}`);
  // Strip BOM and trim.
  return (await res.text()).replace(/^\uFEFF/, "").trim();
}

async function uploadPhoto(objectPath, buf, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": contentType, "x-upsert": "true" },
      body: buf,
    }
  );
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function insertRecipe(rec) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rec),
  });
  if (!res.ok) throw new Error(`insert ${res.status} ${await res.text()}`);
}

// ---- main ----
const items = INVENTORY[category];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-import-"));
const done = await existingTitles(category);

let ok = 0;
let skipped = 0;
let failed = 0;

console.log(`\nImporting "${category}" (${items.length} items)\n`);

for (const it of items) {
  if (done.has(it.title)) {
    console.log(`↷ skip (exists): ${it.title}`);
    skipped++;
    continue;
  }
  try {
    if (it.kind === "image") {
      const src = path.join(tmp, `${it.id}.src`);
      await downloadFile(it.id, src);
      const jpg = path.join(tmp, `${it.id}.jpg`);
      // Convert to JPEG and cap the longest side at 2000px to keep files small.
      execSync(`sips -s format jpeg -Z 2000 "${src}" --out "${jpg}"`, {
        stdio: "ignore",
      });
      const jbuf = fs.readFileSync(jpg);
      const url = await uploadPhoto(
        `${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${it.id}.jpg`,
        jbuf,
        "image/jpeg"
      );
      await insertRecipe({
        title: it.title,
        category,
        description: "",
        photo_url: url,
        ingredients: [],
        steps: [],
        tags: [],
      });
      console.log(`🖼  ${it.title}`);
    } else {
      const text = await docText(it.id);
      const steps = text
        ? text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : [];
      await insertRecipe({
        title: it.title,
        category,
        description: "",
        photo_url: null,
        ingredients: [],
        steps,
        tags: [],
      });
      console.log(`📄 ${it.title} (${steps.length} line${steps.length === 1 ? "" : "s"})`);
    }
    ok++;
  } catch (e) {
    console.log(`✗  ${it.title} — ${e.message}`);
    failed++;
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nDone: ${ok} imported, ${skipped} skipped, ${failed} failed.\n`);

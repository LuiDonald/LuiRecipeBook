// Some "empty" Google Docs actually contain embedded (handwriting) images
// instead of text. Google's txt export drops those images, so we export the doc
// as a .zip (HTML + images/ folder) and pull out any embedded image.
//
// Usage: node scripts/fetch_doc_images.mjs <destDir>
// The doc list is hard-coded below (title + category + id).
// Writes <destDir>/<safeTitle>-<n>.jpg for each embedded image + manifest.json.
//
// Must run OUTSIDE the sandbox (network + `sips` + `unzip`).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const destDir = process.argv[2];
if (!destDir) {
  console.error("Usage: node scripts/fetch_doc_images.mjs <destDir>");
  process.exit(1);
}
fs.mkdirSync(destDir, { recursive: true });

const DOCS = [
  { category: "Chicken", title: "Karage", id: "13N8KsQ8BLLMq6ekd0SEm9t31jSS43f6tddLAyRvzp34" },
  { category: "Chicken", title: "Viet chicken thigh marinate", id: "11ixSX8vODzFN7ooWTde0aZtHpTR4cOK5Hbs6rSifV2E" },
  { category: "Pork", title: "Air fry honey pork belly", id: "13dOo1qSQ9i7QM2ba5lhPrsUGI2UpG5QnAVJJxaOnK1k" },
  { category: "Seafood", title: "Whole shrimp garlic butter", id: "13W39JvkRx_yQJt0uPxuKUUojHqzooNqmyGEDrja-4_E" },
  { category: "Soup", title: "Chinese melon and pork", id: "1-fYBdQ1toXRV0sPsQTLtYSFnSk1DAHNMGVboKq3xs_0" },
  { category: "Rice Bowl / Ramen / Noodle", title: "Chicken beef pho instant pot", id: "1-MUybs8m6yP6IQmLBslWMjx6p4UWp45LUiW74lODdL0" },
];

const safe = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const manifest = [];

for (const d of DOCS) {
  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${d.id}/export?format=zip`,
      { redirect: "follow" }
    );
    if (!res.ok) throw new Error(`zip export ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doc-"));
    const zipPath = path.join(tmp, "doc.zip");
    fs.writeFileSync(zipPath, buf);
    execSync(`unzip -o -q "${zipPath}" -d "${tmp}"`);

    // Embedded images land in an images/ folder inside the zip.
    const imgDir = path.join(tmp, "images");
    const imgs = fs.existsSync(imgDir) ? fs.readdirSync(imgDir) : [];
    if (imgs.length === 0) {
      console.log(`○ ${d.title} — no embedded images`);
      manifest.push({ ...d, images: [] });
      fs.rmSync(tmp, { recursive: true, force: true });
      continue;
    }

    const outFiles = [];
    imgs.forEach((name, i) => {
      const out = path.join(destDir, `${safe(d.title)}-${i + 1}.jpg`);
      execSync(`sips -s format jpeg -Z 2400 "${path.join(imgDir, name)}" --out "${out}"`, {
        stdio: "ignore",
      });
      outFiles.push(out);
    });
    console.log(`✓ ${d.title} — ${outFiles.length} image(s)`);
    manifest.push({ ...d, images: outFiles });
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    console.log(`✗ ${d.title} — ${e.message}`);
    manifest.push({ ...d, error: e.message });
  }
}

fs.writeFileSync(path.join(destDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nmanifest written to ${destDir}/manifest.json`);

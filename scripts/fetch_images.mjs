// Downloads the handwritten-recipe images for a category from the public Drive
// share and converts them to JPEG locally, so they can be read/transcribed.
//
// Usage: node scripts/fetch_images.mjs <Category> <destDir>
// Writes <destDir>/<id>.jpg for each image item, plus <destDir>/manifest.json.
//
// Must run OUTSIDE the sandbox (network + `sips`).

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INVENTORY = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts", "drive_inventory.json"), "utf8")
);

const category = process.argv[2];
const destDir = process.argv[3];
if (!category || !destDir || !INVENTORY[category]) {
  console.error("Usage: node scripts/fetch_images.mjs <Category> <destDir>");
  console.error(`Available: ${Object.keys(INVENTORY).join(", ")}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

const images = INVENTORY[category].filter((it) => it.kind === "image");
const manifest = [];

for (const it of images) {
  try {
    const src = path.join(destDir, `${it.id}.src`);
    const res = await fetch(
      `https://drive.google.com/uc?export=download&id=${it.id}`,
      { redirect: "follow" }
    );
    const buf = Buffer.from(await res.arrayBuffer());
    const head = buf.subarray(0, 64).toString("utf8").toLowerCase();
    if (head.includes("<!doctype") || head.includes("<html")) {
      throw new Error("HTML interstitial");
    }
    fs.writeFileSync(src, buf);
    const jpg = path.join(destDir, `${it.id}.jpg`);
    // Higher resolution helps reading handwriting.
    execSync(`sips -s format jpeg -Z 2400 "${src}" --out "${jpg}"`, {
      stdio: "ignore",
    });
    fs.rmSync(src, { force: true });
    manifest.push({ title: it.title, id: it.id, file: jpg });
    console.log(`✓ ${it.title} -> ${jpg}`);
  } catch (e) {
    console.log(`✗ ${it.title} — ${e.message}`);
  }
}

fs.writeFileSync(
  path.join(destDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);
console.log(`\n${manifest.length} images ready in ${destDir}`);

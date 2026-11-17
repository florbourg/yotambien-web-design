#!/usr/bin/env node
// One-off migration (2026-11-18): move images that each version carried in its own folder
// into the shared, content-addressed store published/assets/, and point the HTML at it.
// Images are byte-identical (same hash), so each published version looks exactly the same.
// Only image paths in the HTML change. Safe to re-run: already-migrated versions are skipped.
const fs = require("fs");
const path = require("path");
const { VERSIONS, ASSETS, ASSETS_FROM_VERSION, rewriteRefs, storeAsset } = require("./lib");

for (const version of fs.readdirSync(VERSIONS).filter((d) => !d.startsWith("."))) {
  const dir = path.join(VERSIONS, version);
  const localFiles = new Set();
  let refs = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const p = path.join(dir, file);
    const html = fs.readFileSync(p, "utf8");
    const out = rewriteRefs(html, (ref) => {
      if (ref.startsWith(ASSETS_FROM_VERSION) || ref.endsWith("/") || /\.html?$/i.test(ref)) return undefined; // page links are navigation, not assets
      const local = path.resolve(dir, ref);
      if (!local.startsWith(dir + path.sep) || !fs.existsSync(local)) return undefined;
      localFiles.add(local);
      refs++;
      return ASSETS_FROM_VERSION + storeAsset(local);
    });
    if (out !== html) fs.writeFileSync(p, out);
  }
  // Remove the per-version copies (subfolders only; HTML stays).
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) fs.rmSync(path.join(dir, entry.name), { recursive: true });
  }
  console.log(`${version}: ${refs} referencias migradas, ${localFiles.size} archivos locales eliminados`);
}
console.log(`published/assets/: ${fs.readdirSync(ASSETS).length} archivos únicos`);

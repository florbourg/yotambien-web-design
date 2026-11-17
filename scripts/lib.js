// Shared helpers for the design repository scripts. No dependencies.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DESIGNS = path.join(ROOT, "designs");
const PUBLISHED = path.join(ROOT, "published");
const VERSIONS = path.join(PUBLISHED, "versions");
const MANIFEST = path.join(PUBLISHED, "manifest.json");
const SEMVER = /^v\d+\.\d+\.\d+$/;

// Relative asset references in a pen.dev html-css export: CSS url(...) plus src/href attributes.
function assetRefs(html) {
  const refs = new Set();
  const patterns = [/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, /\s(?:src|href|poster)\s*=\s*"([^"]+)"/g];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const ref = m[1].trim().replace(/&amp;/g, "&");
      if (/^(https?:|data:|#|mailto:|\/\/)/i.test(ref)) continue;
      refs.add(decodeURIComponent(ref.split(/[?#]/)[0]));
    }
  }
  return [...refs];
}

// Title of an exported screen = data-pencil-name of the first (root) frame.
function screenTitle(html, fallback) {
  const m = html.match(/data-pencil-name="([^"]+)"/);
  return m ? m[1].replace(/&middot;/g, "·").replace(/&amp;/g, "&") : fallback;
}

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
}

function compareSemver(a, b) {
  const pa = a.slice(1).split(".").map(Number);
  const pb = b.slice(1).split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

module.exports = { ROOT, DESIGNS, PUBLISHED, VERSIONS, MANIFEST, SEMVER, assetRefs, screenTitle, readManifest, compareSemver };

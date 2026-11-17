// Shared helpers for the design repository scripts. No dependencies.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DESIGNS = path.join(ROOT, "designs");
const PUBLISHED = path.join(ROOT, "published");
const VERSIONS = path.join(PUBLISHED, "versions");
const ASSETS = path.join(PUBLISHED, "assets");
const MANIFEST = path.join(PUBLISHED, "manifest.json");
const SEMVER = /^v\d+\.\d+\.\d+$/;
// From published/versions/vX.Y.Z/<screen>.html to published/assets/
const ASSETS_FROM_VERSION = "../../assets/";

const REF_PATTERNS = [/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, /\s(?:src|href|poster)\s*=\s*"([^"]+)"/g];
const isExternal = (ref) => /^(https?:|data:|#|mailto:|\/\/)/i.test(ref);
const clean = (ref) => decodeURIComponent(ref.trim().replace(/&amp;/g, "&").split(/[?#]/)[0]);

// Relative asset references in a pen.dev html-css export: CSS url(...) plus src/href attributes.
function assetRefs(html) {
  const refs = new Set();
  for (const re of REF_PATTERNS) for (const m of html.matchAll(re)) if (!isExternal(m[1].trim())) refs.add(clean(m[1]));
  return [...refs];
}

// Replace each relative asset reference using map(cleanRef) -> newRef (or undefined to keep).
function rewriteRefs(html, map) {
  for (const re of REF_PATTERNS) {
    html = html.replace(re, (whole, ref) => {
      if (isExternal(ref.trim())) return whole;
      const next = map(clean(ref));
      return next ? whole.replace(ref, next) : whole;
    });
  }
  return html;
}

// Content-addressed name: same bytes → same file, so each image is stored once across versions.
function hashedName(file) {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
  return hash + path.extname(file).toLowerCase();
}

// Copy `file` into published/assets/ (if not already there) and return its shared name.
function storeAsset(file) {
  const name = hashedName(file);
  const dest = path.join(ASSETS, name);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(ASSETS, { recursive: true });
    fs.copyFileSync(file, dest);
  }
  return name;
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

module.exports = {
  ROOT, DESIGNS, PUBLISHED, VERSIONS, ASSETS, MANIFEST, SEMVER, ASSETS_FROM_VERSION,
  assetRefs, rewriteRefs, hashedName, storeAsset, screenTitle, readManifest, compareSemver,
};

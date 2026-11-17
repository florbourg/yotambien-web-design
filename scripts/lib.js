// Shared helpers for the design repository scripts. No dependencies.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DESIGNS = path.join(ROOT, "designs");
const PUBLISHED = path.join(ROOT, "published");
const ASSETS = path.join(PUBLISHED, "assets");
const MANIFEST = path.join(PUBLISHED, "manifest.json");

// Naming conventions
const DS_ID = /^ds-v\d+\.\d+\.\d+$/;            // Design System versions
const PROD_ID = /^prod-\d{4}\.\d{2}\.\d{2}(-\d+)?$/; // Production releases (date, optional -2 for same day)
const TICKET_KEY = /^[A-Z][A-Z0-9]+-\d+$/;       // Jira key (TBD-1 = provisional)
const ITERATION = /^r\d+$/;                       // Ticket iterations r1, r2…
const LEGACY_ID = /^v\d+\.\d+\.\d+$/;             // First model (published/versions/)
const STATUSES = {
  "en-diseno": "En diseño",
  "en-revision": "En revisión",
  "aprobado": "Aprobado",
  "en-desarrollo": "En desarrollo",
  "en-produccion": "En producción",
  "descartado": "Descartado",
};
const TYPES = { feature: "Feature", fix: "Ajuste / fix" };

const REF_PATTERNS = [/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, /\s(?:src|href|poster)\s*=\s*"([^"]+)"/g];
const isExternal = (ref) => /^(https?:|data:|#|mailto:|\/\/)/i.test(ref);
const clean = (ref) => decodeURIComponent(ref.trim().replace(/&amp;/g, "&").split(/[?#]/)[0]);
const isPageLink = (ref) => ref.endsWith("/") || /\.html?$/i.test(ref);

// Relative references in a pen.dev html-css export: CSS url(...) plus src/href attributes.
function assetRefs(html) {
  const refs = new Set();
  for (const re of REF_PATTERNS) for (const m of html.matchAll(re)) if (!isExternal(m[1].trim())) refs.add(clean(m[1]));
  return [...refs];
}

// Replace each relative reference using map(cleanRef) -> newRef (or undefined to keep).
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

// Content-addressed name: same bytes → same file, so each image is stored once across all publications.
function hashedName(file) {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
  return hash + path.extname(file).toLowerCase();
}

function storeAsset(file) {
  const name = hashedName(file);
  const dest = path.join(ASSETS, name);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(ASSETS, { recursive: true });
    fs.copyFileSync(file, dest);
  }
  return name;
}

// Relative URL from a published folder to published/assets/.
const assetsUrlFrom = (dir) => path.relative(dir, ASSETS).split(path.sep).join("/") + "/";

// Title of an exported screen = data-pencil-name of the first (root) frame.
function screenTitle(html, fallback) {
  const m = html.match(/data-pencil-name="([^"]+)"/);
  return m ? m[1].replace(/&middot;/g, "·").replace(/&amp;/g, "&") : fallback;
}

const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const writeManifest = (m) => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
// Local date (not UTC), so late-night publications get the right day.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Numeric-aware comparison of ids such as ds-v1.10.0 / prod-2026.11.18 / r12.
const compareIds = (a, b) => a.localeCompare(b, "en", { numeric: true });

module.exports = {
  ROOT, DESIGNS, PUBLISHED, ASSETS, MANIFEST,
  DS_ID, PROD_ID, TICKET_KEY, ITERATION, LEGACY_ID, STATUSES, TYPES,
  assetRefs, rewriteRefs, isPageLink, hashedName, storeAsset, assetsUrlFrom, screenTitle,
  readManifest, writeManifest, today, compareIds,
};

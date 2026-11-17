#!/usr/bin/env node
// Validates repository structure, manifest, entry points and assets.
// With BASE_SHA set (CI), also fails if a previously published version was modified or deleted.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { ROOT, DESIGNS, PUBLISHED, VERSIONS, ASSETS, MANIFEST, SEMVER, assetRefs, hashedName, compareSemver } = require("./lib");
const usedAssets = new Set();

const errors = [];
const err = (m) => errors.push(m);
const rel = (p) => path.relative(ROOT, p);

// Structure
for (const p of ["designs", "published/versions", "published/manifest.json", "portal/index.html", "portal/app.js", "portal/styles.css"]) {
  if (!fs.existsSync(path.join(ROOT, p))) err(`Falta ${p}`);
}
const pens = fs.existsSync(DESIGNS) ? fs.readdirSync(DESIGNS, { recursive: true }).filter((f) => String(f).endsWith(".pen")) : [];
if (!pens.length) err("No hay archivos .pen en designs/");

// Manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
} catch (e) {
  err(`manifest.json inválido: ${e.message}`);
}

if (manifest) {
  if (!Array.isArray(manifest.versions) || !manifest.versions.length) err("manifest.versions debe ser un array no vacío");
  const seen = new Set();
  for (const v of manifest.versions || []) {
    const tag = v.version || "(sin versión)";
    if (!SEMVER.test(v.version || "")) err(`${tag}: version debe tener formato vX.Y.Z`);
    if (seen.has(v.version)) err(`${tag}: versión duplicada`);
    seen.add(v.version);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || "")) err(`${tag}: date debe ser YYYY-MM-DD`);
    if (typeof v.notes !== "string") err(`${tag}: notes debe ser texto`);
    if (v.penUrl != null && !/^https:\/\//.test(v.penUrl)) err(`${tag}: penUrl debe ser una URL https`);
    if (v.source && !fs.existsSync(path.join(ROOT, v.source))) err(`${tag}: source ${v.source} no existe`);
    const files = [v.entry, ...(v.screens || []).map((s) => s.path)];
    if (!v.screens || !v.screens.length) err(`${tag}: screens vacío`);
    for (const s of v.screens || []) if (!s.id || !s.title || !s.path) err(`${tag}: cada screen necesita id, title y path`);
    for (const f of files) {
      if (!f) { err(`${tag}: falta entry`); continue; }
      if (!f.startsWith(`versions/${v.version}/`)) err(`${tag}: ${f} debe estar dentro de versions/${v.version}/`);
      const abs = path.join(PUBLISHED, f);
      if (!fs.existsSync(abs)) { err(`${tag}: no existe ${rel(abs)}`); continue; }
      const html = fs.readFileSync(abs, "utf8");
      for (const ref of assetRefs(html).filter((r) => !r.endsWith("/"))) {
        const a = path.resolve(path.dirname(abs), ref);
        const inVersion = a.startsWith(path.join(VERSIONS, v.version) + path.sep);
        const inStore = a.startsWith(ASSETS + path.sep);
        if (!inVersion && !inStore) err(`${tag}: ${f} referencia fuera de su versión y de published/assets/: ${ref}`);
        else if (!fs.existsSync(a)) err(`${tag}: ${f} referencia un asset inexistente: ${ref}`);
        else if (inStore) {
          usedAssets.add(path.basename(a));
          if (hashedName(a) !== path.basename(a)) err(`${tag}: published/assets/${path.basename(a)} no coincide con su hash (¿se modificó?)`);
        }
      }
    }
  }
  const sorted = [...(manifest.versions || [])].map((v) => v.version).filter((v) => SEMVER.test(v)).sort(compareSemver);
  if (sorted.length && manifest.latest !== sorted[sorted.length - 1]) err(`latest debe ser ${sorted[sorted.length - 1]}`);
  if (fs.existsSync(VERSIONS)) {
    for (const d of fs.readdirSync(VERSIONS)) {
      if (d.startsWith(".")) continue;
      if (!seen.has(d)) err(`published/versions/${d} no está en el manifest`);
    }
  }
  if (fs.existsSync(ASSETS)) {
    const orphans = fs.readdirSync(ASSETS).filter((f) => !f.startsWith(".") && !usedAssets.has(f));
    if (orphans.length) console.warn(`⚠ ${orphans.length} archivo(s) en published/assets/ sin usar: ${orphans.join(", ")}`);
  }
}

// Immutability (CI): published version files and shared assets that existed at BASE_SHA must be unchanged.
// ALLOW_PUBLISHED_CHANGES=1 is only for explicit, reviewed migrations (see README).
const base = process.env.BASE_SHA;
if (base && !/^0+$/.test(base) && process.env.ALLOW_PUBLISHED_CHANGES === "1") {
  console.warn("⚠ Migración: se omite el control de inmutabilidad de versiones publicadas.");
} else if (base && !/^0+$/.test(base)) {
  try {
    const out = execSync(`git diff --name-status ${base} HEAD -- published/versions published/assets`, { cwd: ROOT, encoding: "utf8" });
    for (const line of out.trim().split("\n").filter(Boolean)) {
      const [status, file] = line.split("\t");
      if (status !== "A") err(`Contenido publicado modificado (${status}): ${file}. Creá una versión nueva en lugar de editarla.`);
    }
  } catch (e) {
    err(`No se pudo comprobar la inmutabilidad contra ${base}: ${e.message.split("\n")[0]}`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} error(es):\n  - ` + errors.join("\n  - "));
  process.exit(1);
}
console.log(`✓ Válido: ${manifest.versions.length} versión(es), última ${manifest.latest}.`);

#!/usr/bin/env node
// Validates repository structure, manifest, entry points and images.
// With BASE_SHA set (CI), also fails if anything already published was modified or deleted.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const L = require("./lib");

const errors = [];
const err = (m) => errors.push(m);
const usedAssets = new Set();

// Structure
for (const p of ["designs", "published/manifest.json", "portal/index.html", "portal/app.js", "portal/styles.css"]) {
  if (!fs.existsSync(path.join(L.ROOT, p))) err(`Falta ${p}`);
}
const pens = fs.existsSync(L.DESIGNS) ? fs.readdirSync(L.DESIGNS, { recursive: true }).filter((f) => String(f).endsWith(".pen")) : [];
if (!pens.length) err("No hay archivos .pen en designs/");

let m;
try {
  m = L.readManifest();
} catch (e) {
  err(`manifest.json inválido: ${e.message}`);
}

// Checks one publication (entry + screens + every referenced file).
function checkPublication(tag, p, folderPrefix) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) err(`${tag}: date debe ser YYYY-MM-DD`);
  if (typeof p.notes !== "string") err(`${tag}: notes debe ser texto`);
  if (p.source && !fs.existsSync(path.join(L.ROOT, p.source))) err(`${tag}: source ${p.source} no existe`);
  if (p.library && m.library && !m.library.versions.some((v) => v.id === p.library)) err(`${tag}: library ${p.library} no existe`);
  if (!Array.isArray(p.screens) || !p.screens.length) err(`${tag}: screens vacío`);
  const ids = new Set();
  for (const s of p.screens || []) {
    if (!s.id || !s.title || !s.path) err(`${tag}: cada screen necesita id, title y path`);
    if (ids.has(s.id)) err(`${tag}: screen duplicada ${s.id}`);
    ids.add(s.id);
  }
  for (const f of [p.entry, ...(p.screens || []).map((s) => s.path)]) {
    if (!f) { err(`${tag}: falta entry`); continue; }
    if (!f.startsWith(folderPrefix)) err(`${tag}: ${f} debe estar dentro de ${folderPrefix}`);
    const abs = path.join(L.PUBLISHED, f);
    if (!fs.existsSync(abs)) { err(`${tag}: no existe published/${f}`); continue; }
    const html = fs.readFileSync(abs, "utf8");
    for (const ref of L.assetRefs(html)) {
      if (L.isPageLink(ref)) continue;
      const a = path.resolve(path.dirname(abs), ref);
      const inOwn = a.startsWith(path.join(L.PUBLISHED, folderPrefix));
      const inStore = a.startsWith(L.ASSETS + path.sep);
      if (!inOwn && !inStore) err(`${tag}: ${f} referencia algo fuera de su carpeta y de published/assets/: ${ref}`);
      else if (!fs.existsSync(a)) err(`${tag}: ${f} referencia un archivo inexistente: ${ref}`);
      else if (inStore) {
        const name = path.basename(a);
        if (!usedAssets.has(name) && L.hashedName(a) !== name) err(`published/assets/${name} no coincide con su hash (¿se modificó?)`);
        usedAssets.add(name);
      }
    }
  }
}

function checkCollection(label, list, idRe, folderOf, latest) {
  const seen = new Set();
  for (const p of list) {
    const tag = `${label} ${p.id || "(sin id)"}`;
    if (!idRe.test(p.id || "")) err(`${tag}: id con formato inválido`);
    if (seen.has(p.id)) err(`${tag}: duplicado`);
    seen.add(p.id);
    checkPublication(tag, p, folderOf(p));
  }
  if (latest !== undefined) {
    const newest = [...seen].sort(L.compareIds).pop() ?? null;
    if (latest !== newest) err(`${label}: latest debe ser ${newest}`);
  }
  return seen;
}

if (m) {
  for (const k of ["library", "production", "work"]) if (!m[k]) err(`manifest: falta "${k}"`);
  if (m.jiraBaseUrl != null && !/^https:\/\/[^\s]+$/.test(m.jiraBaseUrl)) err("jiraBaseUrl debe ser una URL https o null");
  if (m.penUrl != null && !/^https:\/\/[^\s]+$/.test(m.penUrl)) err("penUrl debe ser una URL https o null");

  const lib = checkCollection("Design System", m.library?.versions || [], L.DS_ID, (p) => `library/${p.id}/`, m.library?.latest);
  if (!lib.size) err("Design System: tiene que haber al menos una versión");
  checkCollection("Producción", m.production?.releases || [], L.PROD_ID, (p) => `production/${p.id}/`, m.production?.latest);

  const keys = new Set();
  for (const t of m.work || []) {
    const tag = `Ticket ${t.key || "(sin clave)"}`;
    if (!L.TICKET_KEY.test(t.key || "")) err(`${tag}: clave con formato inválido (CLAVE-123)`);
    if (keys.has(t.key)) err(`${tag}: clave duplicada`);
    keys.add(t.key);
    if (!t.title) err(`${tag}: falta title`);
    if (!L.TYPES[t.type]) err(`${tag}: type debe ser ${Object.keys(L.TYPES).join(" | ")}`);
    if (!L.STATUSES[t.status]) err(`${tag}: status debe ser ${Object.keys(L.STATUSES).join(" | ")}`);
    if (!Array.isArray(t.iterations) || !t.iterations.length) err(`${tag}: sin iteraciones`);
    const folder = t.iterations?.[0]?.entry?.split("/")[1];
    checkCollection(tag, t.iterations || [], L.ITERATION, (p) => `work/${folder}/${p.id}/`);
    if (t.status === "en-produccion" && !(m.production?.releases || []).some((r) => r.tickets.includes(t.key))) {
      err(`${tag}: está en producción pero ningún release lo incluye`);
    }
  }
  for (const r of m.production?.releases || []) {
    for (const k of r.tickets || []) if (!keys.has(k)) err(`Producción ${r.id}: ticket ${k} no existe`);
  }

  checkCollection("Archivo", m.legacy?.versions || [], L.LEGACY_ID, (p) => `versions/${p.id}/`);

  // Every published folder must be registered.
  const registered = new Set();
  const addDir = (p) => p.entry && registered.add(path.dirname(p.entry));
  [...(m.library?.versions || []), ...(m.production?.releases || []), ...(m.legacy?.versions || [])].forEach(addDir);
  (m.work || []).forEach((t) => t.iterations.forEach(addDir));
  for (const [base, depth] of [["library", 1], ["production", 1], ["versions", 1], ["work", 2]]) {
    const abs = path.join(L.PUBLISHED, base);
    if (!fs.existsSync(abs)) continue;
    const walk = (rel, d) => {
      for (const e of fs.readdirSync(path.join(L.PUBLISHED, rel), { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith(".")) continue;
        const r = `${rel}/${e.name}`;
        if (d === depth) { if (!registered.has(r)) err(`published/${r}/ no está en el manifest`); }
        else walk(r, d + 1);
      }
    };
    walk(base, 1);
  }

  if (fs.existsSync(L.ASSETS)) {
    const orphans = fs.readdirSync(L.ASSETS).filter((f) => !f.startsWith(".") && !usedAssets.has(f));
    if (orphans.length) console.warn(`⚠ ${orphans.length} imagen(es) en published/assets/ sin usar: ${orphans.join(", ")}`);
  }
}

// Immutability (CI): files already published must not change. Only manifest.json and new files may.
// ALLOW_PUBLISHED_CHANGES=1 is only for explicit, reviewed migrations (see README).
const base = process.env.BASE_SHA;
if (base && !/^0+$/.test(base) && process.env.ALLOW_PUBLISHED_CHANGES === "1") {
  console.warn("⚠ Migración: se omite el control de inmutabilidad.");
} else if (base && !/^0+$/.test(base)) {
  try {
    const out = execSync(`git diff --name-status ${base} HEAD -- published`, { cwd: L.ROOT, encoding: "utf8" });
    for (const line of out.trim().split("\n").filter(Boolean)) {
      const [status, file] = line.split("\t");
      if (file === "published/manifest.json") continue;
      if (status !== "A") err(`Contenido publicado modificado (${status}): ${file}. Publicá una versión, iteración o release nuevo.`);
    }
  } catch (e) {
    err(`No se pudo comprobar la inmutabilidad contra ${base}: ${e.message.split("\n")[0]}`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} error(es):\n  - ` + errors.join("\n  - "));
  process.exit(1);
}
console.log(`✓ Válido: Design System ${m.library.latest} · Producción ${m.production.latest} · ${m.work.length} ticket(s) · ${(m.legacy?.versions || []).length} versión(es) en archivo.`);

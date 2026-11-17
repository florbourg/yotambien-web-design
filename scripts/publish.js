#!/usr/bin/env node
// Registers a publication AFTER its HTML was exported from pen.dev into the matching folder.
// It does NOT export anything (the export only works inside pen.dev; see README).
//
//   Design System   node scripts/publish.js ds ds-v1.1.0 --notes "Nuevo componente Badge"
//                   (folder: published/library/ds-v1.1.0/)
//
//   Ticket          node scripts/publish.js work WEB-123/r1 --title "Nuevo formulario" --type feature --notes "Primera propuesta"
//                   node scripts/publish.js work WEB-123/r2 --notes "Cambios de la revisión"
//                   (folder: published/work/WEB-123/r1/; --title/--type only the first time)
//
//   Producción      node scripts/publish.js prod prod-2026.12.01 --tickets WEB-123,WEB-130 --notes "Deploy del 1/12"
//                   (folder: published/production/prod-2026.12.01/, the FULL Producción section)
//
// For each publication it:
//   1. Stores the images referenced by the export once in published/assets/ (content hash) and
//      rewrites only those image paths in the HTML.
//   2. Writes a small static index.html for the folder.
//   3. Adds the entry to published/manifest.json.
const fs = require("fs");
const path = require("path");
const L = require("./lib");

const [kind, id, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i > -1 ? rest[i + 1] : undefined;
};
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const notes = opt("notes") || "";
const source = opt("source") || "designs/yotambien-web.pen";

const manifest = L.readManifest();
let dir;
if (kind === "ds") {
  if (!L.DS_ID.test(id || "")) fail("Uso: publish.js ds ds-vX.Y.Z --notes \"...\"");
  if (manifest.library.versions.some((v) => v.id === id)) fail(`${id} ya existe. Lo publicado no se modifica: usá una versión nueva.`);
  dir = path.join(L.PUBLISHED, "library", id);
} else if (kind === "work") {
  const [key, it] = (id || "").split("/");
  if (!L.TICKET_KEY.test(key || "") || !L.ITERATION.test(it || "")) fail("Uso: publish.js work CLAVE-123/rN --notes \"...\" [--title \"...\" --type feature|fix]");
  const ticket = manifest.work.find((t) => t.key === key);
  if (ticket && ticket.iterations.some((i) => i.id === it)) fail(`${key}/${it} ya existe. Publicá la siguiente iteración.`);
  if (!ticket && !opt("title")) fail(`${key} es un ticket nuevo: agregá --title "..." (y --type feature|fix).`);
  if (opt("type") && !L.TYPES[opt("type")]) fail(`--type debe ser: ${Object.keys(L.TYPES).join(", ")}`);
  dir = path.join(L.PUBLISHED, "work", ticket ? path.dirname(ticket.iterations[0].entry).split("/")[1] : key, it);
} else if (kind === "prod") {
  if (!L.PROD_ID.test(id || "")) fail("Uso: publish.js prod prod-AAAA.MM.DD --tickets CLAVE-1,CLAVE-2 --notes \"...\"");
  if (manifest.production.releases.some((r) => r.id === id)) fail(`${id} ya existe.`);
  dir = path.join(L.PUBLISHED, "production", id);
} else {
  fail("Tipo inválido. Usá: ds | work | prod (ver README).");
}

if (!fs.existsSync(dir)) fail(`No existe ${path.relative(L.ROOT, dir)}/. Exportá primero el HTML desde pen.dev (ver README).`);

// Screens in export order (the README recipe exports them in canvas order), then by name.
const htmlFiles = fs.readdirSync(dir)
  .filter((f) => f.endsWith(".html") && f !== "index.html")
  .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => a.t - b.t || a.f.localeCompare(b.f))
  .map((x) => x.f);
if (!htmlFiles.length) fail("No hay archivos .html exportados en la carpeta.");

// 1. Shared images
const assetsUrl = L.assetsUrlFrom(dir);
const missing = [];
const used = new Set();
const before = fs.existsSync(L.ASSETS) ? fs.readdirSync(L.ASSETS).length : 0;
const outputs = [];
const screens = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  const out = L.rewriteRefs(html, (ref) => {
    if (ref.startsWith(assetsUrl) || L.isPageLink(ref)) return undefined;
    const from = path.resolve(L.DESIGNS, ref);
    if (!from.startsWith(L.DESIGNS + path.sep) || !fs.existsSync(from)) {
      missing.push(`${file}: ${ref}`);
      return undefined;
    }
    const name = L.storeAsset(from);
    used.add(name);
    return assetsUrl + name;
  });
  outputs.push([file, out]);
  screens.push({ id: file.replace(/\.html$/, ""), title: L.screenTitle(html, file), path: path.relative(L.PUBLISHED, path.join(dir, file)).split(path.sep).join("/") });
}
if (missing.length) fail("Faltan imágenes referenciadas por el export (deben estar dentro de designs/):\n  " + missing.join("\n  "));
for (const [file, html] of outputs) fs.writeFileSync(path.join(dir, file), html);
const added = fs.readdirSync(L.ASSETS).length - before;

// 2. Static index (works without the portal)
const label = { ds: `Design System ${id}`, work: `${id.replace("/", " · ")}`, prod: `Producción ${id}` }[kind];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const toRoot = path.relative(dir, path.join(L.PUBLISHED, "..")).split(path.sep).join("/") || ".";
fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Yo También! · ${esc(label)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#1a1a1a}a{color:#1a1a1a}li{margin:8px 0}small{color:#666}</style>
</head>
<body>
<p><a href="${toRoot}/">← Portal de diseño</a></p>
<h1>${esc(label)}</h1>
${notes ? `<p>${esc(notes)}</p>` : ""}
<ul>
${screens.map((s) => `  <li><a href="${path.basename(s.path)}">${esc(s.title)}</a></li>`).join("\n")}
</ul>
<small>Exportado desde pen.dev (${esc(source)}).</small>
</body>
</html>
`);

// 3. Manifest
const entry = path.relative(L.PUBLISHED, path.join(dir, "index.html")).split(path.sep).join("/");
const base = { date: L.today(), notes, source, library: manifest.library.latest, entry, screens };
if (kind === "ds") {
  delete base.library;
  manifest.library.versions.push({ id, ...base });
  manifest.library.versions.sort((a, b) => L.compareIds(b.id, a.id));
  manifest.library.latest = manifest.library.versions[0].id;
} else if (kind === "work") {
  const [key, it] = id.split("/");
  let ticket = manifest.work.find((t) => t.key === key);
  if (!ticket) {
    ticket = { key, title: opt("title"), type: opt("type") || "feature", status: "en-diseno", created: L.today(), updated: L.today(), iterations: [] };
    manifest.work.push(ticket);
  }
  ticket.iterations.push({ id: it, ...base });
  ticket.iterations.sort((a, b) => L.compareIds(b.id, a.id));
  ticket.updated = L.today();
  if (opt("title")) ticket.title = opt("title");
  if (opt("type")) ticket.type = opt("type");
} else {
  const tickets = (opt("tickets") || "").split(",").filter(Boolean);
  for (const k of tickets) {
    const t = manifest.work.find((x) => x.key === k);
    if (!t) fail(`--tickets: ${k} no existe en el manifest.`);
    t.status = "en-produccion";
    t.updated = L.today();
    t.release = id;
  }
  manifest.production.releases.push({ id, ...base, tickets });
  manifest.production.releases.sort((a, b) => L.compareIds(b.id, a.id));
  manifest.production.latest = manifest.production.releases[0].id;
}
L.writeManifest(manifest);

console.log(`${label}: ${screens.length} pantalla(s), ${used.size} imagen(es) (${added} nueva(s), ${used.size - added} reutilizada(s)).`);
console.log("Siguiente: node scripts/validate.js, commit y PR (ver README).");

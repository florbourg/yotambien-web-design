#!/usr/bin/env node
// Finalize a version AFTER its HTML was exported from pen.dev into published/versions/<version>/.
//
//   node scripts/finalize-version.js v1.1.0 --notes "Nueva sección de testimonios" [--order home,escuela,...]
//
// This does NOT export anything. It:
//   1. Stores every image the exported HTML references (from designs/) once in published/assets/,
//      named by content hash, and rewrites only those image paths in the HTML to ../../assets/<hash>.<ext>.
//      Images shared between versions are not duplicated.
//   2. Writes a simple index.html for the version that links to each exported screen.
//   3. Adds the version to published/manifest.json (refuses if it already exists).
const fs = require("fs");
const path = require("path");
const { DESIGNS, VERSIONS, ASSETS, MANIFEST, SEMVER, ASSETS_FROM_VERSION, rewriteRefs, storeAsset, screenTitle, readManifest, compareSemver } = require("./lib");

const args = process.argv.slice(2);
const version = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : undefined;
};
const notes = opt("notes") || "";
const source = opt("source") || "designs/yotambien-web.pen";

if (!version || !SEMVER.test(version)) {
  console.error("Uso: node scripts/finalize-version.js vX.Y.Z --notes \"...\" [--source designs/archivo.pen]");
  process.exit(1);
}
const dir = path.join(VERSIONS, version);
if (!fs.existsSync(dir)) {
  console.error(`No existe ${path.relative(process.cwd(), dir)}. Exportá primero el HTML desde pen.dev (ver README).`);
  process.exit(1);
}
const manifest = readManifest();
if (manifest.versions.some((v) => v.version === version)) {
  console.error(`${version} ya está en el manifest. Las versiones publicadas son inmutables: creá una nueva.`);
  process.exit(1);
}

// Optional --order home,escuela,... (file names without .html); unlisted screens go last, alphabetically.
const order = (opt("order") || "").split(",").filter(Boolean);
const rank = (f) => { const i = order.indexOf(f.replace(/\.html$/, "")); return i === -1 ? Infinity : i; };
const htmlFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html")
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
if (!htmlFiles.length) {
  console.error("No hay archivos .html exportados en la carpeta de la versión.");
  process.exit(1);
}

// 1. Move referenced images into the shared store and point the HTML at it.
//    The export references images relative to the .pen file (designs/); only those paths change.
const missing = [];
const screens = [];
const outputs = [];
const before = fs.existsSync(ASSETS) ? fs.readdirSync(ASSETS).length : 0;
const used = new Set();
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  const rewritten = rewriteRefs(html, (ref) => {
    if (ref.startsWith(ASSETS_FROM_VERSION)) return undefined; // already rewritten
    const from = path.resolve(DESIGNS, ref);
    if (!from.startsWith(DESIGNS + path.sep) || !fs.existsSync(from)) {
      missing.push(`${file}: ${ref}`);
      return undefined;
    }
    const name = storeAsset(from);
    used.add(name);
    return ASSETS_FROM_VERSION + name;
  });
  outputs.push([file, rewritten]);
  screens.push({ id: file.replace(/\.html$/, ""), title: screenTitle(html, file), path: file });
}
if (missing.length) {
  console.error("Faltan assets referenciados por el export (deben estar dentro de designs/):\n  " + missing.join("\n  "));
  process.exit(1);
}
for (const [file, html] of outputs) fs.writeFileSync(path.join(dir, file), html);
const added = fs.readdirSync(ASSETS).length - before;

// 2. Version index page (static, works without the portal).
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
fs.writeFileSync(
  path.join(dir, "index.html"),
  `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Yo También! · Diseño ${version}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 16px; color: #1a1a1a; }
  a { color: #1a1a1a; } li { margin: 8px 0; } small { color: #666; }
</style>
</head>
<body>
<p><a href="../../../">← Portal de diseño</a></p>
<h1>Diseño ${version}</h1>
${notes ? `<p>${esc(notes)}</p>` : ""}
<ul>
${screens.map((s) => `  <li><a href="${s.path}">${esc(s.title)}</a></li>`).join("\n")}
</ul>
<small>Exportado desde pen.dev (${esc(source)}).</small>
</body>
</html>
`
);

// 3. Manifest entry.
manifest.versions.push({
  version,
  date: new Date().toISOString().slice(0, 10),
  notes,
  source,
  entry: `versions/${version}/index.html`,
  screens: screens.map((s) => ({ ...s, path: `versions/${version}/${s.path}` })),
});
manifest.versions.sort((a, b) => compareSemver(b.version, a.version));
manifest.latest = manifest.versions[0].version;
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

console.log(`${version}: ${screens.length} pantallas, ${used.size} imágenes (${added} nuevas en published/assets/, ${used.size - added} reutilizadas), manifest actualizado.`);
console.log(`Siguiente: node scripts/validate.js && git add published && git commit -m "design: ${version}"`);

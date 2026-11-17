#!/usr/bin/env node
// Assembles the static site into _site/:
//   _site/index.html, styles.css, app.js   ← portal/
//   _site/published/...                    ← published/ (manifest + versions)
// All links are relative, so it works under the GitHub Pages project subpath.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib");

const out = path.join(ROOT, "_site");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "portal"), out, { recursive: true });
fs.cpSync(path.join(ROOT, "published"), path.join(out, "published"), {
  recursive: true,
  filter: (src) => path.basename(src) !== ".DS_Store",
});
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`Sitio generado en ${path.relative(process.cwd(), out) || "."}/`);

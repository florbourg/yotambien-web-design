#!/usr/bin/env node
// Changes a ticket's status (and optionally its key or title) in published/manifest.json.
//
//   node scripts/set-status.js WEB-123 en-revision
//   node scripts/set-status.js TBD-1 en-diseno --key WEB-45 --title "Portfolio con filtros"
//
// Statuses: en-diseno → en-revision → aprobado → en-desarrollo → en-produccion (or descartado).
// "en-produccion" is normally set by `publish.js prod --tickets ...` when promoting.
// Changing the key only changes how the ticket is shown and linked; already published files keep their folder.
const L = require("./lib");

const [key, status, ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf(`--${n}`); return i > -1 ? rest[i + 1] : undefined; };
const m = L.readManifest();
const t = m.work.find((x) => x.key === key);
if (!t) { console.error(`No existe el ticket ${key}.`); process.exit(1); }
if (!L.STATUSES[status]) { console.error(`Estado inválido. Usá: ${Object.keys(L.STATUSES).join(", ")}`); process.exit(1); }
const newKey = opt("key");
if (newKey) {
  if (!L.TICKET_KEY.test(newKey)) { console.error("--key debe tener formato CLAVE-123"); process.exit(1); }
  if (m.work.some((x) => x.key === newKey)) { console.error(`${newKey} ya existe.`); process.exit(1); }
  for (const r of m.production.releases) r.tickets = r.tickets.map((k) => (k === key ? newKey : k));
  t.key = newKey;
}
if (opt("title")) t.title = opt("title");
t.status = status;
t.updated = L.today();
L.writeManifest(m);
console.log(`${t.key} · ${t.title}: ${L.STATUSES[status]}`);

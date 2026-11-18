#!/usr/bin/env node
// Applies the Estado / Tipo set in the .pen (theme of each ticket's "Pill · Estado" / "Pill · Tipo" instance) to published/manifest.json.
//
// The .pen is encrypted, so this script cannot read it. The ticket list is read in pen.dev
// through the MCP (see README › "Estado de los tickets en el .pen") and passed here as JSON:
//
//   node scripts/sync-status.js tickets.json
//   echo '[{"key":"TBD-3","title":"Productora","estado":"En revisión","tipo":"Ajuste"}]' | node scripts/sync-status.js
//
// Rules:
//   - Valid Estado: En diseño, En revisión, Aprobado, En desarrollo, Descartado (accents/case ignored).
//   - Valid Tipo: Feature, Ajuste (also accepts "fix").
//   - "En producción" is never set from the .pen: only `publish.js prod --tickets` sets it.
//   - Tickets in the .pen that were never published are reported and skipped (publish an iteration first).
//   - Any invalid value stops the sync without changing anything.
const fs = require("fs");
const L = require("./lib");

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const ESTADOS = { "en diseno": "en-diseno", "en revision": "en-revision", "aprobado": "aprobado", "en desarrollo": "en-desarrollo", "descartado": "descartado" };
const TIPOS = { "feature": "feature", "ajuste": "fix", "ajuste / fix": "fix", "fix": "fix" };

const input = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : fs.readFileSync(0, "utf8");
let tickets;
try {
  tickets = JSON.parse(input);
  if (!Array.isArray(tickets)) throw new Error("se esperaba una lista");
} catch (e) {
  console.error(`JSON inválido: ${e.message}`);
  process.exit(1);
}

const m = L.readManifest();
const errors = [];
const changes = [];
const notes = [];
const seen = new Set();

for (const t of tickets) {
  const key = String(t.key || "").trim();
  if (!L.TICKET_KEY.test(key)) { errors.push(`Nombre de contenedor sin clave válida: «${key} · ${t.title || ""}» (debe ser CLAVE-123 · Título)`); continue; }
  if (seen.has(key)) { errors.push(`${key}: hay dos contenedores con la misma clave`); continue; }
  seen.add(key);
  const status = ESTADOS[norm(t.estado)];
  const type = TIPOS[norm(t.tipo)];
  if (norm(t.estado) === "en produccion") { errors.push(`${key}: «En producción» no se escribe en el .pen; lo asigna la promoción.`); continue; }
  if (!status) { errors.push(`${key}: Estado «${t.estado ?? "(vacío)"}» no es válido. Usá: En diseño, En revisión, Aprobado, En desarrollo o Descartado.`); continue; }
  if (!type) { errors.push(`${key}: Tipo «${t.tipo ?? "(vacío)"}» no es válido. Usá: Feature o Ajuste.`); continue; }

  const ticket = m.work.find((x) => x.key === key);
  if (!ticket) { notes.push(`${key} está en el .pen pero todavía no tiene iteraciones publicadas (se registra al publicar r1).`); continue; }
  if (ticket.status === "en-produccion") { notes.push(`${key} ya está en producción (${ticket.release}); su contenedor debería salir de «En progreso».`); continue; }

  const diff = [];
  if (ticket.status !== status) diff.push(`estado ${L.STATUSES[ticket.status]} → ${L.STATUSES[status]}`);
  if (ticket.type !== type) diff.push(`tipo ${L.TYPES[ticket.type]} → ${L.TYPES[type]}`);
  const title = String(t.title || "").trim();
  if (title && ticket.title !== title) diff.push(`título «${ticket.title}» → «${title}»`);
  if (diff.length) changes.push({ ticket, status, type, title: title || ticket.title, diff });
}

for (const t of m.work) {
  if (!seen.has(t.key) && !["en-produccion", "descartado"].includes(t.status)) {
    notes.push(`${t.key} (${L.STATUSES[t.status]}) no aparece en el .pen. Si se descartó, poné su Estado en «Descartado» antes de borrar el contenedor.`);
  }
}

if (errors.length) {
  console.error(`✗ No se aplicó ningún cambio:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
for (const c of changes) {
  Object.assign(c.ticket, { status: c.status, type: c.type, title: c.title, updated: L.today() });
}
if (changes.length) L.writeManifest(m);

console.log(changes.length ? changes.map((c) => `✓ ${c.ticket.key}: ${c.diff.join(", ")}`).join("\n") : "✓ Sin cambios: el manifest ya coincide con el .pen.");
for (const n of notes) console.log(`ℹ ${n}`);

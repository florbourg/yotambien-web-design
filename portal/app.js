// Design portal: reads published/manifest.json and renders four sections plus a screen viewer.
// Hash routes (work on any GitHub Pages subpath):
//   #/produccion                         current production + release history
//   #/produccion/<release>/<screen>      e.g. #/produccion/prod-2026.11.18/home  ("actual" = latest)
//   #/progreso                           tickets in progress
//   #/progreso/<KEY>/<rN>/<screen>       e.g. #/progreso/WEB-123/r2/home        ("ultima" = latest iteration)
//   #/ds, #/ds/<version>/<screen>        Design System versions               ("actual" = latest)
//   #/archivo, #/archivo/<v>/<screen>    first model (v1.0.0, v2.0.0)
(() => {
  const BASE = "published/";
  const STATUS = {
    "en-diseno": "En diseño", "en-revision": "En revisión", "aprobado": "Aprobado",
    "en-desarrollo": "En desarrollo", "en-produccion": "En producción", "descartado": "Descartado",
  };
  const ACTIVE = ["en-diseno", "en-revision", "aprobado", "en-desarrollo"];
  const TYPE = { feature: "Feature", fix: "Ajuste / fix" };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const enc = encodeURIComponent;
  let M;

  fetch(BASE + "manifest.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((m) => {
      M = m;
      if (M.penUrl) { $("penLink").href = M.penUrl; $("penLink").hidden = false; }
      route();
      addEventListener("hashchange", route);
    })
    .catch((e) => { $("error").hidden = false; $("error").textContent = `No se pudo cargar el manifest: ${e.message}`; });

  // ---------- helpers ----------
  const statusBadge = (s) => `<span class="badge status ${esc(s)}">${esc(STATUS[s] || s)}</span>`;
  const jiraLink = (key) => (M.jiraBaseUrl && !/^TBD-/.test(key)
    ? `<a href="${esc(M.jiraBaseUrl.replace(/\/$/, ""))}/browse/${enc(key)}" target="_blank" rel="noopener">Ver en Jira ↗</a>` : "");
  // Link to the shared pen.dev document, where anyone can leave comments.
  const penComment = (what) => (M.penUrl
    ? `<a class="pen-comment" href="${esc(M.penUrl)}" target="_blank" rel="noopener">💬 Comentar en pen.dev ↗</a><span class="sub">Buscá ${esc(what)} en el canvas.</span>` : "");
  const chips = (hrefBase, screens) => `<div class="chips">${screens.map((s) => `<a href="${hrefBase}/${enc(s.id)}">${esc(s.title)}</a>`).join("")}</div>`;
  const ticketByKey = (k) => M.work.find((t) => t.key === k);
  const setTab = (tab) => document.querySelectorAll(".tabs a").forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });

  function showList(tab, html, title) {
    setTab(tab);
    $("viewer").hidden = true;
    $("list").hidden = false;
    $("list").innerHTML = html;
    document.title = `${title} · Yo También! Diseño`;
    scrollTo(0, 0);
  }

  // ---------- router ----------
  function route() {
    const [tab = "produccion", a, b, c] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    if (tab === "progreso") return a ? viewTicket(a, b, c) : listWork();
    if (tab === "ds") return a ? viewLibrary(a, b) : listLibrary();
    if (tab === "archivo") return a ? viewLegacy(a, b) : listLegacy();
    return a ? viewRelease(a, b) : listProduction();
  }

  // ---------- lists ----------
  function listProduction() {
    const [cur, ...older] = M.production.releases;
    if (!cur) return showList("produccion", `<h1>Producción</h1><p class="empty">Todavía no hay releases.</p>`, "Producción");
    const card = (r, isCur) => `
      <li class="card">
        <h2><a href="#/produccion/${enc(r.id)}">${esc(r.id)}</a>${isCur ? '<span class="badge latest">Actual</span>' : ""}<span class="sub">${esc(r.date)}</span></h2>
        ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
        ${r.tickets?.length ? `<p class="sub">Incluye: ${r.tickets.map((k) => `<a href="#/progreso/${enc(k)}">${esc(k)}</a>`).join(", ")}</p>` : ""}
        ${chips(`#/produccion/${enc(r.id)}`, r.screens)}
        <div class="links"><span class="sub">Design System ${esc(r.library || "—")}</span></div>
      </li>`;
    showList("produccion", `
      <h1>Producción</h1>
      <p class="lead">Diseños de las pantallas publicadas hoy en el sitio. Se actualiza cuando diseño confirma que desarrollo terminó el despliegue.</p>
      <ul class="cards">${card(cur, true)}</ul>
      ${older.length ? `<h2 class="group-title">Releases anteriores</h2><ul class="cards">${older.map((r) => card(r, false)).join("")}</ul>` : ""}`, "Producción");
  }

  function ticketCard(t) {
    const last = t.iterations[0];
    return `
      <li class="card">
        <h2><a href="#/progreso/${enc(t.key)}">${esc(t.key)} · ${esc(t.title)}</a>${statusBadge(t.status)}<span class="badge">${esc(TYPE[t.type] || t.type)}</span></h2>
        <p class="sub">Última iteración ${esc(last.id)} · ${esc(last.date)}${t.iterations.length > 1 ? ` · ${t.iterations.length} iteraciones` : ""}${t.release ? ` · en ${esc(t.release)}` : ""}</p>
        ${last.notes ? `<p>${esc(last.notes)}</p>` : ""}
        ${chips(`#/progreso/${enc(t.key)}/${enc(last.id)}`, last.screens)}
        <div class="links">${jiraLink(t.key)}</div>
      </li>`;
  }

  function listWork() {
    const active = M.work.filter((t) => ACTIVE.includes(t.status)).sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status) || b.updated.localeCompare(a.updated));
    const done = M.work.filter((t) => !ACTIVE.includes(t.status)).sort((a, b) => b.updated.localeCompare(a.updated));
    showList("progreso", `
      <h1>En progreso</h1>
      <p class="lead">Un diseño por ticket de Jira (feature o ajuste). Cada revisión se publica como una iteración nueva: r1, r2…</p>
      ${active.length ? `<ul class="cards">${active.map(ticketCard).join("")}</ul>` : '<p class="empty">No hay tickets activos.</p>'}
      ${done.length ? `<h2 class="group-title">Cerrados</h2><ul class="cards">${done.map(ticketCard).join("")}</ul>` : ""}`, "En progreso");
  }

  function versionList(tab, title, lead, items, hrefRoot, latestId) {
    showList(tab, `
      <h1>${esc(title)}</h1>
      <p class="lead">${esc(lead)}</p>
      <ul class="cards">${items.map((v) => `
        <li class="card">
          <h2><a href="${hrefRoot}/${enc(v.id)}">${esc(v.id)}</a>${v.id === latestId ? '<span class="badge latest">Actual</span>' : ""}<span class="sub">${esc(v.date)}</span></h2>
          ${v.notes ? `<p>${esc(v.notes)}</p>` : ""}
          ${chips(`${hrefRoot}/${enc(v.id)}`, v.screens)}
        </li>`).join("")}</ul>`, title);
  }
  const listLibrary = () => versionList("ds", "Design System", "Librería de fundamentos y componentes con la que se construyen todas las pantallas.", M.library.versions, "#/ds", M.library.latest);
  const listLegacy = () => versionList("archivo", "Archivo", (M.legacy && M.legacy.note) || "Versiones del primer modelo.", (M.legacy && M.legacy.versions) || [], "#/archivo", null);

  // ---------- viewers ----------
  function viewer({ tab, crumbs, meta, pub, hrefBase, screenId, extra = "" }) {
    const s = pub.screens.find((x) => x.id === screenId) || pub.screens[0];
    setTab(tab);
    $("list").hidden = true;
    $("viewer").hidden = false;
    $("crumbs").innerHTML = crumbs;
    $("meta").innerHTML = meta;
    $("screenList").innerHTML = pub.screens.map((x) => `<li><a href="${hrefBase}/${enc(x.id)}"${x === s ? ' aria-current="page"' : ""}>${esc(x.title)}</a></li>`).join("");
    const where = { produccion: "la sección Producción", progreso: "el ticket en la sección En progreso", ds: "la sección Design System" }[tab];
    $("extra").innerHTML = `${where ? penComment(`«${s.title}» en ${where}`) : ""}${extra}<a href="${BASE + pub.entry}">Índice estático</a>`;
    $("extra").querySelectorAll("select[data-nav]").forEach((sel) => sel.addEventListener("change", () => { location.hash = sel.value; }));
    document.title = `${s.title} · Yo También! Diseño`;
    const src = BASE + s.path;
    $("openRaw").href = src;
    const frame = $("frame");
    if (frame.getAttribute("src") !== src) { frame.onload = fit; frame.setAttribute("src", src); } else fit();
  }

  const picker = (label, items, currentId, hrefFor, labelFor) => `
    <label>${esc(label)}</label>
    <select data-nav>${items.map((x) => `<option value="${esc(hrefFor(x))}"${x.id === currentId ? " selected" : ""}>${esc(labelFor(x))}</option>`).join("")}</select>`;

  function viewRelease(id, screen) {
    const r = M.production.releases.find((x) => x.id === (id === "actual" ? M.production.latest : id));
    if (!r) return listProduction();
    viewer({
      tab: "produccion", pub: r, screenId: screen, hrefBase: `#/produccion/${enc(r.id)}`,
      crumbs: `<a href="#/produccion">Producción</a> / ${esc(r.id)}`,
      meta: `<strong>${esc(r.id)}</strong><span>${esc(r.date)}${r.id === M.production.latest ? " · actual" : ""}</span><span>Design System ${esc(r.library || "—")}</span>`,
      extra: picker("Release", M.production.releases, r.id, (x) => `#/produccion/${enc(x.id)}/${enc(screen || "")}`, (x) => `${x.id}${x.id === M.production.latest ? " (actual)" : ""}`),
    });
  }

  function viewTicket(key, itId, screen) {
    const t = ticketByKey(key);
    if (!t) return listWork();
    const it = t.iterations.find((x) => x.id === itId) || t.iterations[0];
    viewer({
      tab: "progreso", pub: it, screenId: screen, hrefBase: `#/progreso/${enc(t.key)}/${enc(it.id)}`,
      crumbs: `<a href="#/progreso">En progreso</a> / ${esc(t.key)}`,
      meta: `<strong>${esc(t.key)} · ${esc(t.title)}</strong><span>${statusBadge(t.status)} <span class="badge">${esc(TYPE[t.type] || t.type)}</span></span><span>${esc(it.id)} · ${esc(it.date)} · DS ${esc(it.library || "—")}</span>${it.notes ? `<span>${esc(it.notes)}</span>` : ""}${jiraLink(t.key)}`,
      extra: picker("Iteración", t.iterations, it.id, (x) => `#/progreso/${enc(t.key)}/${enc(x.id)}/${enc(screen || "")}`, (x) => `${x.id} · ${x.date}`)
        + (M.production.latest ? `<a href="#/produccion/actual">Comparar con Producción actual</a>` : ""),
    });
  }

  function viewLibrary(id, screen) {
    const v = M.library.versions.find((x) => x.id === (id === "actual" ? M.library.latest : id));
    if (!v) return listLibrary();
    viewer({
      tab: "ds", pub: v, screenId: screen, hrefBase: `#/ds/${enc(v.id)}`,
      crumbs: `<a href="#/ds">Design System</a> / ${esc(v.id)}`,
      meta: `<strong>${esc(v.id)}</strong><span>${esc(v.date)}${v.id === M.library.latest ? " · actual" : ""}</span>`,
      extra: picker("Versión", M.library.versions, v.id, (x) => `#/ds/${enc(x.id)}/${enc(screen || "")}`, (x) => x.id),
    });
  }

  function viewLegacy(id, screen) {
    const v = (M.legacy?.versions || []).find((x) => x.id === id);
    if (!v) return listLegacy();
    viewer({
      tab: "archivo", pub: v, screenId: screen, hrefBase: `#/archivo/${enc(v.id)}`,
      crumbs: `<a href="#/archivo">Archivo</a> / ${esc(v.id)}`,
      meta: `<strong>${esc(v.id)}</strong><span>${esc(v.date)} · primer modelo</span>`,
    });
  }

  // Exported screens have fixed pixel widths (e.g. 2315px). Optionally zoom them to the stage width.
  function fit() {
    const frame = $("frame");
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc || !doc.body) return;
    const root = doc.body.firstElementChild;
    doc.documentElement.style.zoom = "";
    if (!$("fit").checked || !root) return;
    const w = root.scrollWidth;
    if (w > frame.clientWidth) doc.documentElement.style.zoom = String(frame.clientWidth / w);
  }
  $("fit").addEventListener("change", fit);
  addEventListener("resize", fit);
})();

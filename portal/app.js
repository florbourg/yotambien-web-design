// Design portal: reads published/manifest.json and renders the version list and a screen viewer.
// Routes (hash-based, so it works on any GitHub Pages subpath):
//   #                     → version list
//   #/v1.0.0              → first screen of v1.0.0
//   #/v1.0.0/home         → screen "home" of v1.0.0
//   #/latest/home         → same, always the newest version
(() => {
  const BASE = "published/";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let manifest;

  fetch(BASE + "manifest.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((m) => { manifest = m; route(); window.addEventListener("hashchange", route); })
    .catch((e) => { $("error").hidden = false; $("error").textContent = `No se pudo cargar el manifest: ${e.message}`; });

  function route() {
    const [, ver, screen] = location.hash.replace(/^#/, "").split("/");
    const v = ver && manifest.versions.find((x) => x.version === (ver === "latest" ? manifest.latest : ver));
    if (v) showViewer(v, screen); else showHome();
  }

  function showHome() {
    $("viewer").hidden = true; $("home").hidden = false;
    $("crumbs").textContent = "";
    $("title").textContent = manifest.title || "Versiones de diseño";
    document.title = manifest.title || "Diseño";
    $("versions").innerHTML = manifest.versions.map((v) => `
      <li class="version">
        <h2><a href="#/${v.version}">${esc(v.version)}</a>
          ${v.version === manifest.latest ? '<span class="badge">Última</span>' : ""}
          <span class="date">${esc(v.date)}</span></h2>
        ${v.notes ? `<p>${esc(v.notes)}</p>` : ""}
        <div class="chips">${v.screens.map((s) => `<a href="#/${v.version}/${encodeURIComponent(s.id)}">${esc(s.title)}</a>`).join("")}</div>
        ${penLink(v)}
      </li>`).join("");
  }

  function penLink(v) {
    const url = v.penUrl || manifest.penUrl;
    return url ? `<a class="pen" href="${esc(url)}" target="_blank" rel="noopener">Abrir en pen.dev ↗</a>` : "";
  }

  function showViewer(v, screenId) {
    const s = v.screens.find((x) => x.id === screenId) || v.screens[0];
    $("home").hidden = true; $("viewer").hidden = false;
    $("crumbs").innerHTML = `<a href="#">Versiones</a> / ${esc(v.version)} / ${esc(s.title)}`;
    document.title = `${s.title} · ${v.version}`;
    document.querySelector(".vmeta").innerHTML =
      `<strong>${esc(v.version)}</strong>${esc(v.date)}${v.version === manifest.latest ? " · última" : ""}`;
    $("screenList").innerHTML = v.screens.map((x) =>
      `<li><a href="#/${v.version}/${encodeURIComponent(x.id)}"${x === s ? ' aria-current="page"' : ""}>${esc(x.title)}</a></li>`).join("");
    document.querySelector(".vlinks").innerHTML =
      `<a href="${BASE + v.entry}">Índice estático de la versión</a>${penLink(v)}`;
    const src = BASE + s.path;
    $("openRaw").href = src;
    const frame = $("frame");
    if (frame.getAttribute("src") !== src) { frame.onload = fit; frame.setAttribute("src", src); } else fit();
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
  window.addEventListener("resize", fit);
})();

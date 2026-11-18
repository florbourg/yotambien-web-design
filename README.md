# Yo También! · Repositorio de diseño web

Diseños del sitio de Yo También! hechos en [pen.dev](https://pen.dev), versionados con un flujo parecido al de desarrollo y publicados en un único portal.

- **Portal:** https://florbourg.github.io/yotambien-web-design/
- **Fuente editable:** `designs/yotambien-web.pen` (pen.dev es la fuente de verdad)
- **Feedback:** se sigue usando el sistema de comentarios de pen.dev.

## El modelo

| Sección (en el `.pen` y en el portal) | Qué contiene | Cómo se publica | Tag de git |
|---|---|---|---|
| **Design System** | Fundamentos (DS · 01) y componentes reutilizables (DS · 02): la "librería" con la que se construyen las pantallas | Versiones `ds-vX.Y.Z` | `ds-vX.Y.Z` |
| **En progreso** | Un contenedor por ticket de Jira: `CLAVE-123 · Título` (feature o ajuste/fix) | Iteraciones `r1`, `r2`… con estado | — |
| **Producción** | Las pantallas que están hoy en el sitio productivo | Releases `prod-AAAA.MM.DD` (foto completa de la sección) | `prod-AAAA.MM.DD` |
| **Archivo** (solo portal) | v1.0.0 y v2.0.0, del primer modelo | Solo lectura | `design-v1.0.0`, `design-v2.0.0` |

Equivalencias con desarrollo:

| Desarrollo | Diseño |
|---|---|
| Librería / paquete de componentes | Design System (`ds-vX.Y.Z`) |
| Rama de feature + PR | Rama `design/CLAVE-123-…` + contenedor del ticket en «En progreso» |
| Preview / staging | Iteraciones `r1`, `r2`… en la pestaña «En progreso» |
| Release a producción | Promoción: release `prod-AAAA.MM.DD` cuando el código ya está desplegado |

**Estados de un ticket:** `en-diseno` → `en-revision` → `aprobado` → `en-desarrollo` → `en-produccion` (o `descartado`).

**Semver del Design System:** `ds-v2.0.0` para cambios que rompen (por ejemplo, renombrar o quitar un componente), `ds-v1.1.0` para agregar componentes o variantes y `ds-v1.0.1` para correcciones.

## Estructura

```text
designs/
  yotambien-web.pen              Secciones «Producción», «En progreso» y «Design System»
  yotambien-web-assets/, yotambien-web/public/brand/   Imágenes que usa el .pen
published/
  manifest.json                  Todo lo publicado: versiones del DS, tickets, releases y archivo
  assets/                        Imágenes, una sola vez para todo (nombre = hash del contenido)
  library/ds-vX.Y.Z/             Export de la sección Design System
  work/CLAVE-123/rN/             Export de las pantallas del ticket, iteración N
  production/prod-AAAA.MM.DD/    Export completo de la sección Producción
  versions/v1.0.0, v2.0.0/       Archivo del primer modelo
portal/                          Portal estático (HTML/CSS/JS sin frameworks)
scripts/
  publish.js                     Registra una publicación (ds | work | prod) después del export
  sync-status.js                 Aplica al manifest el Estado/Tipo leídos del .pen
  set-status.js                  Cambia a mano el estado de un ticket (y su clave o título)
  validate.js                    Valida manifest, archivos, imágenes e inmutabilidad
  build.js                       Arma _site/ para GitHub Pages
```

### Cómo está organizado el `.pen`

pen.dev no tiene páginas: todo vive en un único canvas. Cada sección es un frame contenedor con un hijo `Frames`:

```text
Producción › Frames › Home, Escuela, Productora, Formacion, Nosotros, Dona
En progreso › Frames › «TBD-3 · Productora» › Ticket Info (Estado, Tipo) + Pantallas › Productora
Design System › Frames › DS · 01 Fundamentos, DS · 02 Componentes (los 29 componentes)
```

- **Las pantallas de los tickets usan instancias de los componentes del Design System.** Si cambiás un componente, el cambio se propaga a todas las secciones.
- **Para un ticket que modifica una pantalla existente**, copiá la pantalla desde Producción al contenedor del ticket y editá la copia. Producción no se toca hasta la promoción.
- **Nombres:** el contenedor del ticket se llama exactamente `CLAVE-123 · Título` y sus pantallas van dentro de `Pantallas`. El nombre de cada frame define el nombre del archivo (`Formación` → `formacion.html`), así que dentro de un ticket cada pantalla necesita un nombre distinto.
- **Ticket nuevo:** copiá la **Plantilla de ticket** que está en el encabezado de «En progreso» y pegala dentro de `En progreso › Frames`.

### Estado de los tickets en el `.pen`

Cada contenedor tiene un bloque **Ticket Info** con dos pastillas:

| Campo | Valores válidos |
|---|---|
| **Estado** | En diseño · En revisión · Aprobado · En desarrollo · Descartado |
| **Tipo** | Feature · Ajuste |

**El `.pen` es la fuente de verdad del estado.** Para cambiarlo, editá el texto de la pastilla y guardá (⌘S). La leyenda en el encabezado de «En progreso» muestra los valores y sus colores.

- Tildes y mayúsculas no importan. Un valor mal escrito frena la publicación y te avisa, sin cambiar nada.
- «En producción» no se escribe a mano: lo asigna la promoción (`publish.js prod --tickets`).
- Antes de borrar un ticket que no sigue, poné su Estado en «Descartado» y publicá. Si no, queda colgado en el portal.

**Cómo se sincroniza.** El `.pen` está cifrado: ni los scripts ni GitHub pueden leerlo. En cada publicación, el estado se lee en pen.dev a través del MCP y se aplica con `scripts/sync-status.js`:

```js
// En la herramienta MCP execute: devuelve la lista de tickets del .pen
const section = name => Get((n, c) => { if (!c.parentCtx) { c.skipChildren(); return n.name === name ? n.id : undefined } return undefined })[0]
const field = (id, f) => Get(id, (n, c) => c.parentCtx?.parentCtx?.node.name === f && n.name === "Valor" ? n.content : undefined)[0]
Print(JSON.stringify(Get(section("En progreso"), { depth: 2 }).children.find(c => c.name === "Frames").children
  .map(t => { const [key, ...r] = t.name.split(" · "); return { key, title: r.join(" · "), estado: field(t.id, "Estado"), tipo: field(t.id, "Tipo") } })))
```

```sh
node scripts/sync-status.js tickets.json     # o: echo '<json>' | node scripts/sync-status.js
```

Con Claude Code alcanza con pedir _«publicá»_ o _«sincronizá los estados»_: lee el `.pen`, corre el script y te muestra qué cambió. El título del ticket también se toma del nombre del contenedor.

### ¿Un solo `.pen` o varios?

Por ahora hay **un solo archivo**. Los `.pen` están cifrados y git no puede combinar cambios de dos ramas sobre el mismo archivo. Con una sola diseñadora eso no es un problema: trabajá **un ticket a la vez por rama** y mergeá seguido.

Si el equipo crece, se puede separar (por ejemplo, un `.pen` por ticket). El repo y el portal ya están preparados, porque cada publicación registra su `source`. Lo que **no está resuelto** es compartir los componentes entre archivos. Resultado de la prueba del 2026-11-18:

- El formato `.pen` tiene un campo `imports` para usar componentes de otro archivo.
- El MCP de pen.dev **no ofrece forma de declararlo** y una referencia a un componente de otro archivo falla ("non-existent node").
- No se probó si la interfaz de pen.dev permite configurarlo.

Si no se puede, al separar archivos las pantallas quedarían con copias desconectadas de los componentes.

## Flujos de trabajo

En todos los casos: **rama → editar en pen.dev → exportar → `publish.js` → PR → merge a `main`**. El merge publica el portal automáticamente. Los PR se validan pero no se publican.

### A. Trabajar un ticket (feature o ajuste)

1. **Rama**
   ```sh
   git switch main && git pull
   git switch -c design/WEB-123-formulario-contacto
   ```
2. **En pen.dev:** dentro de `En progreso › Frames`, creá el contenedor `WEB-123 · Formulario de contacto` con un frame `Pantallas` y diseñá adentro (o copiá ahí las pantallas de Producción que vayas a modificar).
3. **Exportá** las pantallas del ticket a `published/work/WEB-123/r1/` (ver [Exportar](#exportar)).
4. **Publicá la iteración**
   ```sh
   node scripts/publish.js work WEB-123/r1 --title "Formulario de contacto" --type feature --notes "Primera propuesta"
   node scripts/validate.js
   ```
5. **PR y merge**
   ```sh
   git add designs published && git commit -m "design(WEB-123): r1 – primera propuesta"
   git push -u origin HEAD && gh pr create --fill
   ```
   Al mergear, el ticket aparece en «En progreso» con estado **En diseño**.
6. **Cada ronda de cambios** es una iteración nueva (`r2`, `r3`…), que publicás con `publish.js work WEB-123/r2 --notes "..."`. Las anteriores siguen visibles.
7. **Estados.** Cambiá la pastilla **Estado** del ticket en el `.pen` (En revisión → Aprobado → En desarrollo) y guardá. Se aplican al publicar (ver [Estado de los tickets en el `.pen`](#estado-de-los-tickets-en-el-pen)). Si hace falta, `set-status.js` sigue sirviendo para cambiarlos a mano en el manifest:
   ```sh
   node scripts/set-status.js WEB-123 en-revision
   ```

### B. Promover a Producción (cuando desarrollo ya desplegó)

Hacelo **solo después de confirmar** que el cambio está en el sitio productivo.

1. `git switch -c release/prod-2026-12-01`
2. **En pen.dev**, mové o copiá las pantallas del ticket a `Producción › Frames`, reemplazando las versiones viejas, y borrá el contenedor del ticket de «En progreso». Su historial queda en el portal.
3. **Exportá toda la sección Producción** a `published/production/prod-2026.12.01/`. Cada release es una foto completa.
4. **Publicá el release**:
   ```sh
   node scripts/publish.js prod prod-2026.12.01 --tickets WEB-123,WEB-130 --notes "Deploy del 1/12: formulario de contacto"
   node scripts/validate.js
   ```
   Los tickets pasan a **En producción** y quedan enlazados al release.
5. PR → merge → tag:
   ```sh
   git switch main && git pull && git tag prod-2026.12.01 && git push origin prod-2026.12.01
   ```
   Si hay dos releases el mismo día, usá `prod-2026.12.01-2`.

### C. Cambiar el Design System

1. `git switch -c ds/badge-component`
2. **Editá** `Design System › Frames` en pen.dev.
3. **Exportá la sección** a `published/library/ds-v1.1.0/`.
4. `node scripts/publish.js ds ds-v1.1.0 --notes "Nuevo componente Badge"`
5. PR → merge → `git tag ds-v1.1.0 && git push origin ds-v1.1.0`

Cada iteración y cada release guardan con qué versión del DS se diseñaron (campo `library`).

### Clave de Jira provisoria

Si todavía no hay ticket, usá `TBD-1`, `TBD-2`… Cuando exista la clave real:

```sh
node scripts/set-status.js TBD-1 en-diseno --key WEB-45
```

Renombrá también el contenedor en el `.pen`. Los archivos ya publicados conservan su carpeta (`work/TBD-1/…`); solo cambia cómo se muestra y enlaza el ticket.

**Enlace a Jira:** completá `"jiraBaseUrl": "https://tuorg.atlassian.net"` en `published/manifest.json` y el portal muestra «Ver en Jira» en cada ticket.

## Exportar

**No hay CLI de pen.dev y el export no corre en GitHub Actions.** Solo funciona con Pen.app abierto en tu Mac, a través de la herramienta MCP `execute`.

La forma probada es pedirle a Claude Code algo como: _«exportá la sección Producción de designs/yotambien-web.pen a published/production/prod-2026.12.01/»_. Por dentro corre esta receta, que exporta en el orden del canvas:

```js
const ROOT = "<ruta al repo>/published/"
const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const section = name => Get((n, c) => { if (!c.parentCtx) { c.skipChildren(); return n.name === name ? n.id : undefined } return undefined })[0]
const framesOf = id => Get(id, { depth: 2 }).children.find(c => c.name === "Frames").children
const exportAll = (frames, dir) => { for (const f of frames) Export([f.id], "html-css", ROOT + dir + "/" + slug(f.name) + ".html") }

exportAll(framesOf(section("Producción")), "production/prod-2026.12.01")
exportAll(framesOf(section("Design System")), "library/ds-v1.1.0")
// Un ticket:
const t = framesOf(section("En progreso")).find(f => f.name.startsWith("WEB-123 "))
exportAll(Get(t.id, { depth: 2 }).children.find(c => c.name === "Pantallas").children, "work/WEB-123/r1")
```

**Qué hace `publish.js` con el export:**
- Guarda cada imagen una sola vez en `published/assets/` y cambia en el HTML solo las rutas de las imágenes.
- Genera un `index.html` para la carpeta.
- Agrega la entrada al manifest.

No genera ni modifica el diseño.

## Reglas que controla el CI

`.github/workflows/deploy.yml` corre `validate.js` en cada PR y en cada push a `main`. Solo `main` se publica en GitHub Pages. El CI controla que:

- El manifest sea válido (formatos de ids, estados, tipos, tickets referenciados por releases).
- Existan todas las pantallas e imágenes, y cada imagen coincida con su hash.
- Toda carpeta publicada esté registrada en el manifest.
- **Nada publicado se modifique ni se borre.** Solo `manifest.json` puede cambiar (estados, títulos) y se pueden agregar archivos nuevos. Para corregir algo se publica una iteración, versión o release nuevo.
- Excepción: una migración explícita y revisada, con `[migracion]` en el título del PR y en el commit de merge.

## Limitaciones

- **El export requiere Pen.app abierto en una Mac.** Cada publicación empieza ahí; el resto (validar, armar el sitio, publicar) es automático.
- El HTML es una foto estática de cada frame: ancho fijo (~2315 px), sin interacción ni responsive. Las fuentes se cargan desde Google Fonts.
- El `.pen` está cifrado: git no muestra diffs ni combina cambios. Trabajá un ticket por rama y mergeá seguido.
- Las imágenes que ya no use nada no se borran (`validate.js` las avisa).
- El estado de los tickets se actualiza a mano. No hay integración con Jira.
- **Cuidado al usar el MCP:** si se le pasa la ruta de un `.pen` que no existe, ejecuta sobre el documento que está abierto. Pasó en la prueba de `imports` y se corrigió.

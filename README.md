# Yo También! · Repositorio de diseño web

Versionado y publicación de los diseños del sitio de Yo También!, hechos en [pen.dev](https://pen.dev).

- **Portal publicado:** https://florbourg.github.io/yotambien-web-design/
- **Fuente editable:** `designs/yotambien-web.pen` (pen.dev es la fuente de verdad)
- **Feedback:** se sigue usando el sistema de comentarios de pen.dev.

Esta es una prueba de concepto. No está conectada a React, Storybook ni al código de producción.

## Estructura

```text
designs/                         Fuente editable (se abre con pen.dev)
  yotambien-web.pen              Las 7 páginas + el design system (DS · 01 y DS · 02)
  yotambien-web-assets/          Imágenes usadas en el .pen
  yotambien-web/public/brand/    Logos e íconos usados en el .pen
published/
  manifest.json                  Lista de versiones (la lee el portal)
  versions/vX.Y.Z/               Una carpeta por versión, inmutable
    home.html, escuela.html …    Export HTML real de pen.dev, una pantalla por archivo
    index.html                   Índice estático de la versión
    yotambien-web-assets/ …      Copia de las imágenes que usa esa versión
portal/                          Sitio estático (HTML/CSS/JS sin frameworks)
scripts/
  finalize-version.js            Copia assets, crea el índice y agrega la versión al manifest
  validate.js                    Valida estructura, manifest, archivos y assets
  build.js                       Arma _site/ (portal + published/) para GitHub Pages
.github/workflows/deploy.yml     Valida y publica en GitHub Pages
```

### Cambios respecto de la estructura propuesta, y por qué

- **El `.pen` está en `designs/`, no en `designs/screens/`.** Un solo archivo contiene todas las páginas y el design system, así que no hay `foundations/` separado. Además el `.pen` referencia las imágenes con rutas relativas (`yotambien-web-assets/…`, `yotambien-web/public/brand/…`). Si se mueve el archivo sin sus carpetas, las imágenes se rompen.
- **Las imágenes de cada versión no van en `assets/`.** El export de pen.dev mantiene las mismas rutas relativas que usa el `.pen`. Para no tocar el HTML exportado, las imágenes se copian dentro de la versión respetando esas rutas.

## Cómo funciona el export (lo que se probó)

| Pregunta | Resultado |
|---|---|
| ¿Hay CLI de pen.dev? | **No.** Pen.app (v1.2.23) solo trae `mcp-server-darwin-arm64`, un puente hacia la app abierta. No tiene comandos de export. |
| ¿Se puede exportar a HTML? | **Sí**, con la función `Export(nodeIds, "html-css", ruta)` de la herramienta MCP `execute` (también existe `"html-tailwind"` y png/jpeg/webp/pdf/svg). |
| ¿Funciona en GitHub Actions? | **No.** El MCP necesita la app de escritorio abierta y con sesión iniciada. Los `.pen` están cifrados y no se pueden leer sin la app. |
| ¿El HTML incluye todo? | El CSS va inline y las fuentes se cargan desde Google Fonts (hace falta internet). **Las imágenes no se incluyen ni se copian**: quedan referenciadas con rutas relativas al `.pen`. Eso lo resuelve `finalize-version.js`. |
| ¿Cómo es el HTML? | Fiel visualmente, con anchos fijos en px (las páginas miden ~2315 px). No es responsive ni interactivo. El portal tiene la opción "Ajustar al ancho". |

Por eso el flujo es: **export en tu Mac → todo lo demás automatizado.**

## Crear una versión nueva

Convención: `v1.1.0` para un cambio de diseño significativo y `v1.1.1` para una corrección menor. Las versiones publicadas no se editan nunca, siempre se crea una nueva (el CI falla si se modifica una existente).

1. **Rama de trabajo**
   ```sh
   git switch -c diseno/testimonios
   ```
2. **Editá** `designs/yotambien-web.pen` en pen.dev (abrí el archivo **del repo**, no otra copia) y guardá.
3. **Exportá a HTML** dentro de `published/versions/v1.1.0/`, un archivo por frame. Hay dos formas:
   - **Con Claude Code + MCP de pen.dev** (la probada): pedile _"exportá cada frame de nivel superior de designs/yotambien-web.pen como html-css a published/versions/v1.1.0/&lt;nombre&gt;.html"_. Por dentro corre:
     ```js
     Export(["K2QR7"], "html-css", "<repo>/published/versions/v1.1.0/home.html")
     ```
   - **Desde la interfaz de pen.dev**: usá la opción de export a HTML/CSS si tu versión la muestra (no se verificó en esta prueba) y guardá cada frame como `<nombre>.html` en esa carpeta.

   IDs actuales: Home `K2QR7`, Escuela `xJyha`, Productora `RJkP3`, Formacion `I7Sfe`, Nosotros `oM8DK`, Dona `ADXRs`, Portfolio `a1MQt`, DS · 01 `b3qevC`, DS · 02 `ECRWf`.
4. **Finalizá la versión** (Node 18+):
   ```sh
   node scripts/finalize-version.js v1.1.0 --notes "Agrega sección de testimonios en Escuela" \
     --order home,escuela,productora,formacion,nosotros,dona,portfolio,ds-01-fundamentos,ds-02-componentes
   node scripts/validate.js
   ```
   Esto copia las imágenes referenciadas, crea `index.html` y agrega la entrada a `manifest.json` (fecha de hoy, pantallas tomadas del HTML).
5. **Revisá localmente** (opcional):
   ```sh
   node scripts/build.js && npx serve _site   # o: cd _site && python3 -m http.server
   ```
6. **Commit, push y PR**
   ```sh
   git add designs published
   git commit -m "design: v1.1.0 – testimonios"
   git push -u origin diseno/testimonios
   gh pr create --fill
   ```
   En el PR, el workflow **valida pero no publica**.
7. **Merge a `main` y tag.** Al mergear se publica automáticamente. Después:
   ```sh
   git switch main && git pull
   git tag design-v1.1.0 && git push origin design-v1.1.0
   ```

## El manifest

`published/manifest.json` lo genera `finalize-version.js`, pero se puede editar a mano (por ejemplo, para corregir notas antes de publicar):

```json
{
  "title": "Yo También! · Diseño web",
  "latest": "v1.0.0",
  "penUrl": "https://… (opcional, link general al documento de pen.dev)",
  "versions": [
    {
      "version": "v1.0.0",
      "date": "2026-11-17",
      "notes": "…",
      "source": "designs/yotambien-web.pen",
      "penUrl": "https://… (opcional, por versión)",
      "entry": "versions/v1.0.0/index.html",
      "screens": [{ "id": "home", "title": "Home", "path": "versions/v1.0.0/home.html" }]
    }
  ]
}
```

Si agregás `penUrl`, el portal muestra el botón "Abrir en pen.dev".

## Publicación (GitHub Actions)

`.github/workflows/deploy.yml` corre en cada push a `main`, en cada PR a `main` y a mano (`workflow_dispatch`):

1. `validate.js`: estructura, manifest, que existan los HTML y los assets referenciados, y que no se haya modificado ninguna versión ya publicada.
2. `build.js`: arma `_site/`.
3. Solo en `main`: `actions/configure-pages` → `actions/upload-pages-artifact` → `actions/deploy-pages`.

Todos los links son relativos, así que funcionan bajo el subpath `/yotambien-web-design/`.

## Ver versiones

- Lista de versiones: https://florbourg.github.io/yotambien-web-design/
- Una pantalla: `…/#/v1.0.0/home`
- Siempre la última: `…/#/latest/home`
- HTML directo: `…/published/versions/v1.0.0/home.html`

## Limitaciones actuales

- **El export no se puede automatizar en CI**: requiere Pen.app abierto en una Mac con sesión iniciada.
- El HTML es una foto estática de cada frame: ancho fijo, sin interacción ni responsive.
- Las fuentes dependen de Google Fonts en línea.
- Cada versión copia sus imágenes (~22 MB en v1.0.0). Con muchas versiones el repo crece. Si llegara a ser un problema, se puede evaluar Git LFS o deduplicar los assets.
- El `.pen` está cifrado: Git guarda las versiones, pero no muestra diffs legibles. Las diferencias se ven comparando las versiones publicadas.

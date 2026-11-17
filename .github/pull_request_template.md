## Tipo

- [ ] Ticket: iteración (`publish.js work CLAVE-123/rN`)
- [ ] Ticket: cambio de estado (`set-status.js`)
- [ ] Promoción a Producción (`publish.js prod prod-AAAA.MM.DD --tickets …`)
- [ ] Design System (`publish.js ds ds-vX.Y.Z`)
- [ ] Otro (portal, scripts, docs)

## Ticket(s) de Jira

<!-- CLAVE-123 · Título -->

## Qué cambia

## Checklist

- [ ] El `.pen` se guardó en pen.dev antes de exportar.
- [ ] Exporté desde el `.pen` del repo (`designs/yotambien-web.pen`).
- [ ] `node scripts/validate.js` pasa localmente.
- [ ] Promoción: confirmé con desarrollo que el cambio ya está desplegado en producción.
- [ ] Después del merge: tag `ds-vX.Y.Z` o `prod-AAAA.MM.DD` si corresponde.

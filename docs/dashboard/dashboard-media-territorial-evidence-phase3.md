# Dashboard Media & Territorial Evidence — Phase 3

## Estado

`🟡 Implementado en rama · pendiente CI, merge y certificación productiva`

## Objetivo

Convertir la fotografía desde un detalle de UI en una capa de media/evidencia reutilizable y con procedencia, empezando por dos superficies prioritarias del Dashboard:

1. preservar el flujo de avatar cívico sobre un proveedor compartido;
2. habilitar evidencia fotográfica segura en reportes territoriales.

La fase mantiene el principio **evidence-first** de VÉRTICE: una fotografía puede respaldar una afirmación o resultado, pero no equivale por sí sola a identidad verificada, validación comunitaria ni verificación de una acción.

## P3.0 — Identity Media closure

`civic-avatar.service.ts` deja de implementar directamente el protocolo de Cloudflare Images y consume el proveedor común de media.

Se conservan los invariantes anteriores:

- `verification_level` sigue siendo la fuente de verdad de identidad verificada;
- avatar público y verificación de identidad siguen siendo estados separados;
- la carga continúa fail-closed si Cloudflare Images no está configurado;
- reemplazar/eliminar avatar mantiene limpieza best-effort del asset remoto.

## P3.1 — Shared Media Provider

Nuevo módulo:

`apps/api/src/modules/media/media-provider.ts`

Responsabilidades:

- readiness del proveedor;
- direct upload intents;
- metadata de ownership/purpose;
- inspección del asset remoto;
- resolución de URL de entrega;
- borrado best-effort.

El proveedor soporta actualmente dos propósitos explícitos:

- `civic_profile_avatar`;
- `territorial_report_evidence`.

## P3.2 — Media provenance

Migración `20260908023000_media_assets_territorial_evidence`.

### `media_assets`

Registra:

- proveedor y asset remoto;
- ciudadano propietario;
- propósito;
- estado `pending / confirmed / attached / rejected / deleted`;
- URL pública derivada por servidor;
- fechas de creación/confirmación/expiración.

### `territorial_report_media`

Vincula de manera única un asset confirmado a un reporte y conserva su posición (0–4).

`territorial_reports.media_urls` se conserva como **proyección compatible de lectura** para no romper feed, detalle, mapas ni clientes existentes. Las nuevas escrituras ya no aceptan URLs arbitrarias como evidencia.

## P3.3 — Report evidence upload

Nuevos endpoints autenticados y limitados por rate limit:

- `POST /territorial/media/upload-intent`;
- `POST /territorial/media/confirm`;
- `POST /territorial/reports/:id/media`.

`POST /territorial/reports` incorpora `media_asset_ids` (máximo cinco).

Antes de vincular un asset, el servidor verifica:

- UUID conocido;
- propietario = ciudadano autenticado;
- purpose = `territorial_report_evidence`;
- estado confirmado;
- URL pública existente;
- asset todavía no utilizado por otro reporte;
- máximo cinco evidencias por reporte.

La creación del reporte y el vínculo de sus evidencias ocurren dentro de la misma transacción PostgreSQL.

## P3.4 — Dashboard capture UX

`/dashboard/reports/new` incorpora:

- selección múltiple;
- captura con cámara compatible mediante `capture=environment`;
- JPEG/PNG/WebP;
- máximo 10 MB por archivo;
- máximo cinco archivos;
- previews;
- eliminación antes de publicar;
- estados pending/uploading/confirmed/error;
- direct upload sin transportar bytes por la API de VÉRTICE;
- reintento desde el mismo formulario si falla una evidencia.

Las fotografías siguen siendo opcionales: un reporte legítimo no queda bloqueado por carecer de imagen.

## P3.5 — Evidencia posterior a publicación

El owner puede adjuntar nuevos assets confirmados mediante `POST /territorial/reports/:id/media` mientras el total no supere cinco.

No se habilita borrado histórico de evidencia en esta fase. Esa decisión es deliberada: remover evidencia ya vinculada requiere una política de auditoría/moderación antes de exponer una mutación destructiva.

## P3.6 — Integración visual

El listado de reportes recibe `media_urls` en el summary contract y utiliza la primera evidencia como thumbnail, además de mostrar el número de evidencias.

La página de detalle ya consumía `media_urls` y continúa presentando la galería existente sin cambio de contrato.

## Seguridad y privacidad

- las nuevas escrituras no confían en URL de media proporcionada por el navegador;
- el direct upload se asocia a owner + purpose mediante metadata del proveedor y se revalida al confirmar;
- un asset confirmado solo puede adjuntarse una vez;
- rate limiting protege upload intent, confirmación y attachment;
- los bytes de imagen no atraviesan el proceso Fastify;
- las imágenes entregadas al cliente proceden del pipeline de imágenes configurado, no del archivo local del navegador.

La política de retención/cleanup de intents expirados queda identificada operacionalmente por `expires_at`; un job de recolección puede incorporarse en una fase de operaciones sin cambiar el contrato de producto.

## Configuración productiva requerida

La función permanece fail-closed si faltan:

- `CLOUDFLARE_IMAGES_ACCOUNT_ID`;
- `CLOUDFLARE_IMAGES_API_TOKEN`;
- `CLOUDFLARE_IMAGES_DELIVERY_URL` (recomendado; puede resolverse desde variants si el proveedor los devuelve);
- `CLOUDFLARE_IMAGES_VARIANT=public`.

## Certificación

La fase se considera cerrada únicamente cuando:

1. API typecheck/tests/lint verdes;
2. web typecheck/build verdes;
3. E2E `report-media.spec.ts` verde;
4. migración aplicada correctamente en Railway;
5. variables de Cloudflare Images disponibles en producción;
6. prueba real: seleccionar foto → upload directo → confirmar → crear reporte → thumbnail/listado → galería/detalle;
7. prueba real de avatar posterior a la extracción del proveedor común;
8. verificación móvil de cámara/galería y conexión lenta.

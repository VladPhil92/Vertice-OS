# Phase 7 — Pro Usage & Community Resilience

## Objetivo

Convertir VÉRTICE Pro de un catálogo de capacidades a un contrato operacional medible, endurecer la Red Cívica para que una falla localizada no convierta datos parciales en una caída total de la experiencia, y habilitar exportación operativa y publicación cívica automatizada como capacidades Pro reales sin tocar reputación.

## Metering de capacidad

La autoridad de límites permanece en `billing.catalog.ts`:

- Free: 20 solicitudes de IA/mes, 3 proyectos activos, 0 publicaciones programadas/mes.
- Pro: 500 solicitudes de IA/mes, 50 proyectos activos, 100 publicaciones programadas/mes.
- Almacenamiento conserva su capacidad declarada, pero la UI no muestra consumo hasta que exista telemetría confiable de bytes.

`billing_usage_counters` registra únicamente consumo operacional (`metric` ∈ `{ai_request, scheduled_post}`), aislado de reputación, ranking, voto y autoridad cívica.

### IA

Cada operación generativa autenticada reserva una unidad mensual antes de llamar al servicio AI (`runWithAiUsageQuota`). La reserva es atómica en PostgreSQL y falla con `AI_MONTHLY_QUOTA_EXCEEDED` al superar la capacidad del plan. Si el proveedor AI falla, la unidad se libera.

### Publicaciones programadas

`POST /publishing/scheduled` (gated por el entitlement `PUBLISHING_AUTOMATION`, solo Pro) reserva una unidad mensual con `reserveScheduledPost` antes de encolar la publicación; si la inserción o el encolado del job falla, la unidad se libera con `releaseScheduledPost`. La publicación efectiva ocurre de forma asíncrona vía el job durable `publish_civic_update`, que el worker existente ejecuta con `run_after = scheduled_for`.

Una publicación cívica publicada aparece en `GET /community/feed` como una actividad más (`type: 'publication'`), pero con `civic_score = 0` y excluida explícitamente del liderazgo y del promedio de puntaje del perfil público — publicar más contenido nunca compra reputación ni ranking.

### Exportación operativa

`GET /dashboard/me/export.csv` (gated por el entitlement `EXPORT_REPORTS`, solo Pro) genera un CSV UTF-8 con BOM a partir del mismo `getCitizenCommandCenter` que alimenta el Dashboard: perfil, participación histórica, atención pendiente y gestión propia. No introduce una fuente de datos paralela.

La API expone `GET /billing/me/usage` y el Dashboard (`/dashboard/operations`) muestra uso, capacidad restante y qué métricas son realmente medidas, incluyendo IA y publicaciones programadas.

## Resiliencia de Red Cívica

`GET /community/feed` conserva el comportamiento normal cuando todos los dominios responden. Si la lectura combinada falla, el boundary intenta reportes y propuestas por separado:

- si una fuente responde, devuelve datos parciales y `availability.degraded = true`;
- identifica explícitamente cuál fuente está `unavailable`;
- si ambas fuentes fallan, conserva el error original en lugar de presentar una lista vacía como si fuera válida.

La UI muestra un aviso de disponibilidad parcial y permite reintentar sin bloquear las demás superficies del Dashboard.

## Invariantes

1. Suscripción y consumo nunca generan reputación.
2. Los límites se aplican en backend, no en JavaScript.
3. Un error del proveedor AI no consume definitivamente una solicitud.
4. Métricas sin telemetría no se representan como cero.
5. Datos parciales se identifican como parciales.
6. El score cívico y sus señales de evidencia no se recalculan por degradación del feed.
7. Una publicación cívica programada nunca genera `civic_score`, ni entra al liderazgo ni al promedio de puntaje del perfil.

## Certificación

- unit tests de quota/metering (IA y publicaciones programadas);
- unit tests de degradación parcial del feed;
- tests de rutas AI para el límite mensual;
- Playwright de consumo de plan y banner de Red Cívica;
- Playwright de capacidad operativa (`/dashboard/operations`), exportación y programación de publicaciones;
- Dashboard Browser Release Gate actualizado para incluir Phase 7, `apps/api/src/modules/publishing/**` y `apps/api/prisma/migrations/**`.

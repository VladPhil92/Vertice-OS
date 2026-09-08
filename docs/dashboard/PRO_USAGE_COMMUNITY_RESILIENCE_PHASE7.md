# Phase 7 — Pro Usage & Community Resilience

## Objetivo

Convertir VÉRTICE Pro de un catálogo de capacidades a un contrato operacional medible y endurecer la Red Cívica para que una falla localizada no convierta datos parciales en una caída total de la experiencia.

## Metering de capacidad

La autoridad de límites permanece en `billing.catalog.ts`:

- Free: 20 solicitudes de IA/mes y 3 proyectos activos.
- Pro: 500 solicitudes de IA/mes y 50 proyectos activos.
- Almacenamiento y publicaciones programadas conservan sus capacidades declaradas, pero la UI no muestra consumo hasta que exista telemetría confiable.

`billing_usage_counters` registra únicamente consumo operacional. Está explícitamente aislado de reputación, ranking, voto y autoridad cívica.

### IA

Cada operación generativa autenticada reserva una unidad mensual antes de llamar al servicio AI. La reserva es atómica en PostgreSQL y falla con `AI_MONTHLY_QUOTA_EXCEEDED` al superar la capacidad del plan. Si el proveedor AI falla, la unidad se libera.

La API expone `GET /billing/me/usage` y el Dashboard muestra uso, capacidad restante y qué métricas son realmente medidas.

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

## Certificación

- unit tests de quota/metering;
- unit tests de degradación parcial del feed;
- tests de rutas AI para el límite mensual;
- Playwright de consumo de plan y banner de Red Cívica;
- Dashboard Browser Release Gate actualizado para incluir Phase 7.

# Phase 1 — Golden E2E Journeys

Fecha de ejecución: **8 de septiembre de 2026**.

## Objetivo

Pasar de pruebas fragmentadas por módulo a una matriz explícita de recorridos críticos que permita demostrar qué parte de VÉRTICE está realmente integrada y qué parte solo dispone de contratos UI o código presente.

Esta fase no añade un nuevo dominio funcional. Certifica verticalmente capacidades existentes.

## Semántica de certificación

VÉRTICE distingue tres niveles de evidencia E2E:

1. **Browser contract** — Playwright ejecuta UI real de Next.js, pero puede interceptar dependencias HTTP. Demuestra navegación, render, serialización y reglas visibles. **No prueba persistencia ni proveedor real**.
2. **Integration journey** — API real + PostgreSQL/PostGIS + Redis + Neo4j efímeros en CI. Demuestra autorización, persistencia, idempotencia y estado durable dentro del backend de VÉRTICE.
3. **Staging/provider certification** — servicios desplegados del mismo SHA + proveedores externos/canaries aplicables. Es el único nivel que puede elevar una integración externa a `READY`/`CERTIFIED` según `RELEASE_GOVERNANCE.md`.

Un browser contract verde nunca debe presentarse como evidencia de que Wompi, Mercado Pago, Veriff, CTG One u otro proveedor externo está certificado.

## Matriz Golden

| Journey | Browser contract | Integration journey | Staging/provider | Estado de esta fase |
|---|---|---|---|---|
| GJ-01 Auth/session lifecycle | Sí | **Sí** | Pendiente | Integration-covered |
| GJ-02 Citizen action + evidence | Sí | **Sí** | Pendiente | Integration-covered |
| GJ-03 Territorial reporting | Sí | Pendiente PostGIS vertical | Pendiente | Browser-covered |
| GJ-04 Proposal/governance | Sí | Pendiente electorate/tally vertical | Pendiente | Browser-covered |
| GJ-05 CTG One federation | Sí | Pendiente cross-service | Pendiente canary | Browser-covered |
| GJ-06 Civic identity assurance | **Sí, safety boundary** | Component coverage existente | Pendiente provider canary | Safety-covered |
| GJ-07 Crowdfunding readiness | **Sí, fail-closed boundary** | Readiness/component coverage existente | Pendiente financial canary | Safety-covered |

## Entregables

- `apps/api/src/__tests__/golden-journeys.integration.test.ts`
- `apps/web/e2e/golden-safety.spec.ts`
- `apps/web/package.json` → `e2e:golden`
- `.github/workflows/golden-e2e-journeys.yml`
- este documento de matriz y Definition of Done

## GJ-01 — Auth/session lifecycle

Recorrido ejecutado contra API y persistencia reales de CI:

`register → login → authenticated /me → refresh → logout → refresh replay rejected`

Invariantes:

- el refresh token permanece en cookie HttpOnly a nivel de ruta;
- logout revoca la sesión server-side;
- un refresh token revocado no puede crear un nuevo access token;
- el access token inicial debe corresponder al ciudadano recién creado.

## GJ-02 — Citizen action + evidence

Recorrido ejecutado contra API y persistencia reales de CI:

`verified fixture → login → create action → retry → evidence → retry → evidence ledger → mine`

Invariantes:

- el fixture de `verificationLevel = 1` existe **solo dentro del test** para iniciar este journey después de la frontera de proofing;
- el fixture nunca certifica identity assurance de producción;
- crear la misma acción con la misma `Idempotency-Key` no duplica la operación;
- adjuntar la misma evidencia con la misma `Idempotency-Key` no duplica el ledger;
- la acción persiste y aparece en la superficie `mine` del mismo ciudadano.

## Golden Browser Suite

El comando:

```text
pnpm --filter @vertice/web e2e:golden
```

ejecuta una selección estable de contratos Playwright para:

- auth y route protection;
- acciones cívicas;
- reportes territoriales;
- propuestas;
- federación CTG One;
- identity-assurance safety boundary;
- crowdfunding financial-readiness safety boundary.

### Identity safety boundary

La UI debe mantener separados:

`login/authentication ≠ basic verification ≠ civic identity assurance`

Incluso si el status básico informa nivel verificado, la interfaz no puede mostrar elegibilidad de gobernanza cuando `identity/assurance.governance_eligible` es `false`.

### Crowdfunding fail-closed boundary

Una persona puede estar KYC/KYB-ready y tener destino BRE-B confirmado, pero si el proveedor de recaudo, desembolso o certificación de plataforma está bloqueado:

- `platform_ready = false`;
- `ready_for_campaign_activation = false`;
- la campaña no muestra acción de activar recaudo;
- dinero/KYC/aportes siguen sin modificar reputación, ranking, voto, autoridad o alcance orgánico.

## Workflow de CI

`Golden E2E Journeys` crea dos checks independientes:

### Golden Browser Journeys

- instala Chromium;
- construye la aplicación web del SHA exacto;
- levanta Next.js localmente;
- ejecuta la suite Playwright Golden;
- conserva log del servidor si falla.

### Golden API Journeys

- levanta PostgreSQL/PostGIS, Redis y Neo4j;
- inicializa el esquema de integración;
- ejecuta exclusivamente los journeys marcados por `GOLDEN_API_JOURNEYS=1`;
- evita que la suite normal dispare accidentalmente integración contra servicios reales.

## Qué NO certifica todavía esta fase

Aún no existe evidencia suficiente para declarar completamente E2E:

- reporte territorial desde UI hasta PostGIS y vuelta al mapa;
- propuesta → electorate freeze → participación → tally durable en una sola corrida vertical;
- CTG One real de extremo a extremo entre ambos servicios;
- webhook/canary real de proveedor de identidad;
- checkout/webhook/reconciliación/refund/payout contra proveedor financiero real;
- ejecución sobre staging desplegado y comprobación de revision SHA.

Esos recorridos son la **Phase 1B — Vertical Runtime Certification** y deben añadirse sobre esta base sin degradar los gates actuales.

## Definition of Done — Phase 1A

- [x] suite Golden de navegador definida;
- [x] GJ-01 auth/session integration journey creado;
- [x] GJ-02 civic action/evidence integration journey creado;
- [x] identity-assurance safety contract creado;
- [x] crowdfunding fail-closed safety contract creado;
- [x] workflow CI independiente creado;
- [x] env de tests corregido para respetar infraestructura inyectada;
- [ ] `Golden Browser Journeys` verde en PR;
- [ ] `Golden API Journeys` verde en PR;
- [ ] merge después de Phase 0;

## Gate para Phase 1B

No iniciar Mobile Core Parity como siguiente gran fase hasta que, como mínimo, GJ-03 y GJ-04 tengan integration journeys reales. Crowdfunding e identity provider pueden permanecer fail-closed mientras las credenciales/canaries externos no estén disponibles.

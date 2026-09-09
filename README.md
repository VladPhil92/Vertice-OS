# VÉRTICE OS

> **Sistema Operativo Cívico — Colombia**  
> Infraestructura digital para participación, gestión comunitaria, evidencia, deliberación, decisión, control ciudadano y activación territorial continua.

[![Estado](https://img.shields.io/badge/Estado-Release%20candidate-C8A84B?style=flat-square)](https://github.com/VladPhil92/Vertice-OS)
[![CI](https://img.shields.io/github/actions/workflow/status/VladPhil92/Vertice-OS/ci.yml?style=flat-square&label=CI)](https://github.com/VladPhil92/Vertice-OS/actions)
[![Piloto](https://img.shields.io/badge/Nodo%20piloto-Cartagena%20de%20Indias-C0392B?style=flat-square)](https://es.wikipedia.org/wiki/Cartagena_de_Indias)

**Snapshot documental:** 9 de septiembre de 2026.  
**Baseline:** Node.js 22.13+, pnpm 10, Next.js 15.5.24, Fastify 5 y Expo SDK 57 / React Native 0.86.3.

## Qué es VÉRTICE OS

VÉRTICE OS es una plataforma cívica nacional conectada al ecosistema CTG One. Organiza actividad social y comunitaria alrededor de evidencia, resultados y reputación verificable, sin reducir el producto a una plataforma electoral.

Flujo conceptual:

`Cuenta → Territorio → Acción / Reporte → Evidencia → Identidad cívica → Propuesta → Deliberación → Decisión → Control → Reputación`

La arquitectura territorial soporta Colombia → departamento → municipio/distrito → localidad/comuna → barrio/vereda, con Cartagena como primer nodo de piloto controlado.

## Estado funcional

| Área | Estado | Contrato actual |
|---|---|---|
| Web / PWA | ✅ Implementado | Experiencia pública, dashboard ciudadano, offline fallback y web push |
| Dashboard | ✅ Implementado | Actividad, atención, reputación, acciones, reportes, propuestas, legal, workflows, billing/crowdfunding |
| API | ✅ Implementado | REST/Fastify con autoridad server-side y persistencia durable |
| Red cívica | ✅ Implementado | Feed, perfiles, follow/unfollow, ranking y validación comunitaria separada del score |
| Acciones y evidencia | ✅ Implementado | Lifecycle cívico, media/evidence y trazabilidad |
| Territorio nacional | ✅ Implementado | DANE/DIVIPOLA, PostGIS, selector nacional, nodos públicos y activación |
| Gobernanza | ✅ Implementado | Padrón congelado, participación durable y tally reconstruible |
| Reputación | ✅ Implementado | Score/eventos separados de identidad, dinero y popularidad |
| Workflows / legal | ✅ Implementado | Expedientes desde reporte hacia análisis, propuesta y control |
| Identity Assurance | 🟡 Integrado | Frontera fail-closed; Veriff requiere credenciales/canary externo real |
| Crowdfunding | 🟡 Integrado | Lifecycle, fees, readiness, payment/payout control plane; proveedores reales requieren certificación |
| VÉRTICE Pro | ✅ Implementado | Metering, cuotas y operaciones Pro sin alterar reputación |
| App móvil | ✅ Paridad de dominio implementada | Auth, territorio, acciones, mapa/media, gobernanza, push, community, workflows, identity y crowdfunding tracking |
| Blockchain | 🟡 Opcional | Contratos Polygon disponibles; despliegue productivo no es requisito del core |
| Producción | 🟡 Release por evidencia | Código, deploy, readiness y proveedores se certifican por separado |

## Arquitectura

```text
apps/web — Next.js 15.5.24 / React 18
  │
  │ HTTPS / REST
  ▼
apps/api — Fastify 5 / TypeScript / Prisma
  ├─ PostgreSQL + PostGIS  (estado canónico)
  ├─ Redis                 (cache/rate-limit/pubsub)
  ├─ Neo4j                 (grafo degradable)
  └─ apps/ai               (FastAPI / LangGraph / RAG)

apps/mobile — Expo SDK 57 / React Native 0.86.3
  └─ consume los mismos contratos API; no duplica autoridad de dominio

contracts/ — Solidity / Hardhat / Polygon (opcional)
```

## Invariantes de producto y seguridad

- Autenticación no equivale a Civic Identity Assurance.
- Seleccionar territorio no equivale a residencia verificada.
- Reputación alta no concede identidad ni autoridad.
- Seguidores, likes e impresiones no inflan el score cívico.
- Pagos, donaciones, KYC/KYB, suscripciones y payouts no cambian reputación, ranking, voto o autoridad.
- El navegador y el cliente móvil no determinan settlement, payout ni elegibilidad financiera.
- PII y sentido individual del voto no se publican on-chain.
- Código presente no equivale a release certificado.

## Release engineering

El repositorio usa estados explícitos:

`IMPLEMENTED → INTEGRATED → DEPLOYED → READY → CERTIFIED`

Entre los gates existentes se incluyen CI general, Semgrep, Golden E2E, Golden Governance, Golden Financial Integrity, Production Hardening, runtime contracts, National Platform Readiness, National Account Onboarding, Mobile Core Parity, Mobile Device Release y Mobile Domain Parity.

La infraestructura de piloto dispone de same-SHA runtime canary para distinguir una fusión de un runtime realmente desplegado.

## App móvil

La paridad de dominio base incluye:

- registro/login nacional y sesión segura con SecureStore;
- selección y activación territorial;
- acciones cívicas y evidencia;
- reportes, GPS, mapa, cámara/galería y media confirmada por servidor;
- propuestas, avales, voto y tally canónico;
- notificaciones push/inbox/deep links;
- Community/Feed, ranking y perfiles públicos;
- Workflows/expedientes;
- Civic Identity Assurance/proofing/provider handoff;
- crowdfunding campaign/readiness tracking.

La deuda móvil restante es principalmente externa: signing, EAS, APNs/FCM, Maps key, dispositivos físicos y stores. Ver [`apps/mobile/README.md`](./apps/mobile/README.md).

## Inicio rápido

```bash
git clone https://github.com/VladPhil92/Vertice-OS.git
cd Vertice-OS
pnpm install --frozen-lockfile
cp .env.example .env

docker compose up -d
pnpm --filter @vertice/api db:deploy
pnpm dev
```

### Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm mobile
```

### Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-mobile-domain-parity.mjs
pnpm --filter @vertice/mobile build
```

## Despliegue documentado

| Capa | Destino |
|---|---|
| Web | Vercel |
| API | Railway |
| AI | Railway |
| Mobile | EAS / App Store / Google Play |

Los secretos productivos se provisionan externamente; no se versionan.

## Documentación clave

- [`docs/CURRENT_STATE.md`](./docs/CURRENT_STATE.md) — snapshot técnico-funcional.
- [`docs/engineering/MARKET_RELEASE_COMPLETION.md`](./docs/engineering/MARKET_RELEASE_COMPLETION.md) — separación exacta entre trabajo automatizable y trabajo del operador.
- [`docs/engineering/MOBILE_DOMAIN_PARITY_PHASE2D2_4.md`](./docs/engineering/MOBILE_DOMAIN_PARITY_PHASE2D2_4.md) — cierre de paridad móvil.
- [`docs/engineering/RELEASE_GOVERNANCE.md`](./docs/engineering/RELEASE_GOVERNANCE.md) — semántica de release.
- [`docs/security/CIVIC_IDENTITY_ASSURANCE.md`](./docs/security/CIVIC_IDENTITY_ASSURANCE.md) — frontera de identidad cívica.
- [`docs/integrations/CTG_ONE.md`](./docs/integrations/CTG_ONE.md) — federación CTG One.

## Intervención externa obligatoria antes de lanzamiento comercial completo

- proteger `main` y seleccionar required checks;
- EAS + Apple Developer + Google Play Console + signing;
- pruebas físicas Android/iOS;
- credenciales/canaries de Veriff y Cloudflare Images;
- bounded canaries de Mercado Pago y Wompi/BRE-B antes de dinero real abierto;
- aprobación legal/privacidad/compliance;
- revisión y aprobación de App Store / Google Play.

La matriz completa y verificable se mantiene en [`docs/engineering/MARKET_RELEASE_COMPLETION.md`](./docs/engineering/MARKET_RELEASE_COMPLETION.md).

---

**Fundador y Arquitecto de Producto:** Juan Pablo Valderrama Pino  
**Organización:** CTG One Corporation  
**Nodo piloto:** Cartagena de Indias, Bolívar, Colombia

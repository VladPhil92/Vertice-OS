# VÉRTICE OS

> **Sistema Operativo Cívico — Cartagena de Indias, Colombia**  
> Infraestructura digital para participación, gestión comunitaria, deliberación, decisión, evidencia y control ciudadano continuo.

[![Estado](https://img.shields.io/badge/Estado-Desarrollo%20activo-C8A84B?style=flat-square)](https://github.com/VladPhil92/Vertice-OS)
[![CI](https://img.shields.io/github/actions/workflow/status/VladPhil92/Vertice-OS/ci.yml?style=flat-square&label=CI)](https://github.com/VladPhil92/Vertice-OS/actions)
[![Licencia](https://img.shields.io/badge/Licencia-Propietaria-1A2744?style=flat-square)](./LICENSE)
[![Piloto](https://img.shields.io/badge/Piloto-Cartagena%20de%20Indias-C0392B?style=flat-square)](https://es.wikipedia.org/wiki/Cartagena_de_Indias)

**Snapshot documental:** 7 de septiembre de 2026.  
**Baseline de plataforma:** Node.js 22.13+, pnpm 10, web Next.js 15.5.24 y app nativa Expo SDK 57 / React Native 0.86.3.

---

## Qué es VÉRTICE OS

VÉRTICE OS es una plataforma cívica conectada al ecosistema CTG One. Organiza la actividad social y comunitaria alrededor de evidencia, resultados y reputación verificable, sin reducir el producto a una plataforma electoral.

Flujo conceptual principal:

`Identidad → Acción / Reporte → Evidencia → IA cívica → Propuesta → Deliberación → Decisión → Control → Reputación`

La plataforma combina:

- dashboard ciudadano web;
- API cívica modular;
- red y acciones comunitarias;
- reportes territoriales y mapas;
- gobernanza y votaciones consultivas;
- reputación cívica;
- control público / herramientas legales;
- IA multiagente;
- notificaciones y eventos en tiempo real;
- contratos inteligentes donde la inmutabilidad aporta valor;
- cliente móvil nativo iOS/Android.

Los datos personales y la lógica operacional permanecen fuera de cadena.

---

## Estado funcional

| Área | Estado | Contrato actual |
|---|---|---|
| Dashboard ciudadano | ✅ Implementado | Centro de mando autenticado con actividad, atención, reputación, reportes, propuestas, legal, workflows y acciones cívicas |
| Red / gestión comunitaria | ✅ Implementado | Perfil, actividad social-comunitaria, evidencia y trayectoria pública |
| Identidad y autenticación web | ✅ Implementado | Login local + federación CTG One; refresh web por cookie httpOnly |
| Autenticación móvil nativa | ✅ Baseline implementado | `/auth/mobile/*`, sesiones canónicas y almacenamiento seguro Keychain/Keystore |
| Roles y autoridad | ✅ Implementado | Grants persistentes, rol activo por sesión y revalidación server-side |
| Motor territorial | ✅ Implementado | Reportes georreferenciados, PostGIS y superficies de mapa |
| Gobernanza | ✅ Implementado | Propuestas, padrón congelado y ledger canónico de participación |
| Reputación cívica | ✅ Implementado | Eventos, score, badges y soporte de grafo |
| Control público / legal | ✅ Implementado | Documentos y workflows asistidos |
| IA multiagente | ✅ Implementado | FastAPI/LangGraph, RAG y degradación segura de proveedores opcionales |
| Tiempo real | ✅ Implementado | SSE, Redis pub/sub y notificaciones |
| PWA web | ✅ Implementado | Manifest, service worker, offline fallback y web push |
| App móvil nativa | 🟡 Primera fase funcional | Login, sesión, command center, reputación, atención, perfil y EAS; faltan superficies nativas de todos los módulos |
| Identity provider externo | 🟡 Integrado / certificación real pendiente | Diseño fail-closed; requiere credenciales y canary externo antes de autoridad cívica |
| Blockchain | 🟡 Código disponible | Contratos Hardhat/Polygon; despliegue depende del entorno |
| Producción | 🟡 Requiere certificación por release | Web/API/AI deben demostrar CI + deploy + readiness, no solo código presente |

### Límites explícitos

- CTG One SSO no equivale por sí solo a `civic identity assurance`.
- Una foto de perfil no eleva `verification_level`.
- Las votaciones de VÉRTICE son mecanismos cívicos/consultivos salvo que exista un procedimiento institucional externo que les otorgue otra fuerza jurídica.
- Proveedores KYC/IDV, blockchain y servicios externos no deben anunciarse como productivos mientras sus canaries/credenciales reales no estén certificados.
- El repositorio no se considera “100% terminado” solo porque los módulos existan; release, operación, observabilidad y certificación externa forman parte del estado real.

---

## Arquitectura

```text
┌──────────────────────────────────────────────────────────────┐
│                  apps/web — Next.js 15.5.24                 │
│ Dashboard · Community · Reports · Governance · Legal · AI   │
│ Workflows · Reputation · Authority · PWA                    │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS / REST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    apps/api — Fastify 5                     │
│ auth · dashboard · identity · territorial · governance      │
│ community · civic-actions · reputation · legal · workflows  │
│ notifications · events · AI proxy                           │
│ Prisma · PostgreSQL/PostGIS · Redis · Neo4j                 │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
                ▼                               ▼
       apps/ai — FastAPI                apps/mobile — Expo 57
       LangGraph + RAG                  React Native 0.86.3
                                        Expo Router + SecureStore

┌──────────────────────────────────────────────────────────────┐
│ contracts/ — Solidity + Hardhat · Polygon                   │
│ CivicSBT · VotingRegistry                                   │
└──────────────────────────────────────────────────────────────┘
```

La API operativa es REST sobre Fastify. GraphQL/Apollo no debe documentarse como gateway productivo mientras no vuelva a existir como contrato ejecutable.

---

## Stack actual

| Capa | Tecnología |
|---|---|
| Web | Next.js `15.5.24`, React 18, TypeScript, Tailwind, Framer Motion, Mapbox, TanStack Query, Zustand |
| Mobile | Expo SDK 57, React Native `0.86.3`, React `19.2.3`, Expo Router, SecureStore |
| Backend | Fastify `5.11.x`, TypeScript, Prisma 5, Zod, JWT, bcrypt |
| IA | Python 3.12, FastAPI, LangGraph, Anthropic, Pinecone, Voyage AI |
| Datos | PostgreSQL + PostGIS, Redis, Neo4j |
| Blockchain | Solidity `^0.8.24`, Hardhat, OpenZeppelin 5, Polygon |
| Monorepo | pnpm `10.34.5`, Turborepo 2 |
| Observabilidad | Sentry + `/health` + `/health/ready` |
| Deploy | Vercel (web), Railway (API/AI), EAS (mobile build pipeline) |

---

## Inicio rápido

### Requisitos

- Node.js `>=22.13`
- pnpm `>=10`
- Docker + Docker Compose
- Python 3.12 para `apps/ai`

```bash
git clone https://github.com/VladPhil92/Vertice-OS.git
cd Vertice-OS
pnpm install --frozen-lockfile
cp .env.example .env

docker compose up -d
pnpm --filter @vertice/api db:deploy
pnpm dev
```

Servicios locales habituales:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- AI: `http://localhost:8001`

### App móvil

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm mobile
```

Para un dispositivo físico, `EXPO_PUBLIC_API_URL` debe apuntar a un origen HTTPS o LAN accesible por el dispositivo. No introducir secretos en variables `EXPO_PUBLIC_*`.

---

## Comandos principales

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck

pnpm mobile
pnpm mobile:android
pnpm mobile:ios
pnpm mobile:typecheck
pnpm --filter @vertice/mobile doctor

pnpm --filter @vertice/api db:generate
pnpm --filter @vertice/api db:migrate
pnpm --filter @vertice/api db:deploy

pnpm --filter @vertice/contracts compile
pnpm --filter @vertice/contracts test
```

---

## Seguridad y release

Invariantes principales:

- privilegios se derivan de grants vivos y sesión activa, no de un rol legacy estático;
- el refresh web permanece en cookie httpOnly;
- el refresh móvil solo se expone en `/auth/mobile/*` y debe persistirse en SecureStore;
- PII y sentido individual del voto no deben publicarse on-chain;
- PostgreSQL y Redis son requeridos para readiness; Neo4j puede degradarse;
- secretos productivos no se versionan en Kubernetes: `secrets.example.yaml` es solo estructura;
- un commit no equivale a un release: CI, deployment y readiness deben verificarse por separado.

---

## Documentación clave

- [`docs/CURRENT_STATE.md`](./docs/CURRENT_STATE.md) — estado técnico-funcional y límites.
- [`docs/TECHNOLOGY_REFRESH_2026-09-07.md`](./docs/TECHNOLOGY_REFRESH_2026-09-07.md) — auditoría y actualización tecnológica de septiembre de 2026.
- [`apps/mobile/README.md`](./apps/mobile/README.md) — arquitectura, seguridad y operación del cliente nativo.
- [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md) — arquitectura general.
- [`docs/security/CIVIC_IDENTITY_ASSURANCE.md`](./docs/security/CIVIC_IDENTITY_ASSURANCE.md) — frontera de confianza de identidad cívica.
- [`docs/integrations/CTG_ONE.md`](./docs/integrations/CTG_ONE.md) — federación con CTG One.
- [`docs/deployment/railway-vercel.md`](./docs/deployment/railway-vercel.md) — runtime y despliegue web/API.

---

## Acciones que requieren intervención externa

El código puede preparar estos flujos, pero no debe simular su ejecución:

- proteger `main` con required checks y revisión;
- provisionar secretos reales en infraestructura;
- certificar despliegues Railway/Vercel después de cada release;
- configurar proyecto EAS y credenciales Apple/Google;
- completar fichas, privacidad, content rating y revisión de App Store / Play Store;
- ejecutar canaries reales de proveedores de identidad y otras integraciones externas.

---

## Créditos

**Fundador y Arquitecto de Producto:** Juan Pablo Valderrama Pino  
**Organización:** CTG One Corporation  
**Ciudad piloto:** Cartagena de Indias, Bolívar, Colombia

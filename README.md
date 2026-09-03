# VÉRTICE OS

> **Sistema Operativo Cívico — Cartagena de Indias, Colombia**  
> Infraestructura digital para participación, deliberación, decisión y control ciudadano continuo.

[![Estado](https://img.shields.io/badge/Estado-Desarrollo%20activo-C8A84B?style=flat-square)](https://github.com/VladPhil92/Vertice-OS)
[![CI](https://img.shields.io/github/actions/workflow/status/VladPhil92/Vertice-OS/ci.yml?style=flat-square&label=CI)](https://github.com/VladPhil92/Vertice-OS/actions)
[![Licencia](https://img.shields.io/badge/Licencia-Propietaria-1A2744?style=flat-square)](./LICENSE)
[![Piloto](https://img.shields.io/badge/Piloto-Cartagena%20de%20Indias-C0392B?style=flat-square)](https://es.wikipedia.org/wiki/Cartagena_de_Indias)

> **Snapshot documental:** 2 de septiembre de 2026. El paquete raíz conserva la versión técnica `0.1.0`; el estado funcional del producto ha avanzado sustancialmente respecto de la documentación original de la Fase I.

---

## ¿Qué es VÉRTICE OS?

VÉRTICE OS es una plataforma de infraestructura cívica conectada al ecosistema CTG One. Su objetivo es convertir la participación ciudadana en un flujo continuo y trazable:

`Identidad → Reporte territorial → IA cívica → Propuesta → Deliberación → Votación → Decisión → Control público → Reputación`

El sistema combina un dashboard ciudadano, una API modular, un servicio de IA multiagente, datos geoespaciales, reputación cívica, eventos en tiempo real y contratos inteligentes. La blockchain se reserva para evidencias que realmente necesitan inmutabilidad; los datos personales y la lógica operacional permanecen fuera de cadena.

---

## Estado funcional actual

| Área | Estado | Implementación actual |
|---|---|---|
| **Dashboard ciudadano** | ✅ Implementado | `Mi VÉRTICE`, atención pendiente, actividad personal, reportes, propuestas, votos, control público, IA, reputación y expedientes cívicos |
| **Workflows cívicos** | ✅ Implementado | Expediente durable que conecta reporte → análisis IA → propuesta → gobernanza → acción legal/control público |
| **Identidad y autenticación** | ✅ Implementado / P0 activo | Login local + federación CTG One; separación explícita entre autenticación, contacto verificado y civic identity assurance |
| **Roles y autoridad** | ✅ Implementado | Grants persistentes `citizen/moderator/admin/superadmin`, `active_role` por sesión, JWT ligado a sesión, panel de autoridad y bootstrap controlado del superadmin raíz |
| **Motor territorial** | ✅ Implementado | Reportes georreferenciados, mapa, PostGIS, análisis y escalamiento desde el dashboard |
| **Gobernanza** | ✅ Implementado | Propuestas, padrón electoral congelado, delegaciones y ledger canónico de participación para democracia líquida |
| **Ledger de voto** | ✅ Implementado | Previene doble influencia directa/delegada, admite override directo de voto previamente delegado y reconstruye tallies desde registros durables |
| **Reputación cívica** | ✅ Implementado | Eventos de reputación, score y soporte Neo4j sin convertir reputación en credencial de identidad |
| **Control público / Legal** | ✅ Implementado | Generación y gestión de documentos de control ciudadano y acciones legales asistidas por IA |
| **IA multiagente** | ✅ Implementado | 7 agentes LangGraph + RAG Pinecone/Voyage AI + fallback seguro cuando RAG externo no está configurado |
| **Tiempo real** | ✅ Implementado | Eventos SSE + Redis pub/sub y notificaciones |
| **Blockchain** | 🟡 Código disponible | Contratos Hardhat para Polygon; el despliegue/registro on-chain depende de configuración y certificación del entorno |
| **Producción** | 🟡 En convergencia | Web en Vercel; API y servicio AI en Railway. El runtime usa health/readiness y Docker como contrato canónico de arranque |

### Lo que **no** debe darse por implementado todavía

- Integración directa con Registraduría Nacional o un proveedor KYC/liveness productivo no está certificada por defecto.
- `CTG One SSO` no equivale a `civic identity assurance`.
- MongoDB, Kafka, The Graph, DAO y otros componentes descritos en documentos tempranos son arquitectura potencial, no dependencias obligatorias del runtime actual.
- Las votaciones de VÉRTICE son mecanismos cívicos/consultivos; no sustituyen por sí mismas los procedimientos administrativos o electorales legalmente vinculantes.

---

## Arquitectura actual

```text
┌──────────────────────────────────────────────────────────────┐
│                  apps/web — Next.js 15                      │
│  Dashboard · Identity · Reports · Governance · Legal · AI   │
│  Workflows · Reputation · Authority · PWA                   │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼───────────────────────────────────┐
│                  apps/api — Fastify 5                       │
│ auth · dashboard · identity · territorial · governance      │
│ reputation · legal · ai · workflows · notifications · SSE   │
│ Prisma ORM · PostgreSQL/PostGIS · Redis · Neo4j             │
└────────────────────┬──────────────────────┬──────────────────┘
                     │                      │
                     │                      └── Redis pub/sub / cache / sessions
                     │
                     └──────────────► apps/ai — FastAPI + LangGraph
                                      7 agentes · Claude · RAG
                                      Pinecone + Voyage AI

┌──────────────────────────────────────────────────────────────┐
│ contracts/ — Solidity + Hardhat · Polygon PoS / Amoy        │
│ CivicSBT · VotingRegistry                                   │
└──────────────────────────────────────────────────────────────┘
```

La API productiva es actualmente **REST sobre Fastify**. No se debe documentar Apollo Federation/GraphQL como gateway operativo salvo que vuelva a introducirse explícitamente en el código.

---

## Stack verificado en el repositorio

| Capa | Tecnología |
|---|---|
| **Frontend** | Next.js `15.5.23`, React 18, TypeScript, Tailwind CSS, Framer Motion, Mapbox, TanStack Query, Zustand |
| **Backend** | Fastify `5.11.2`, TypeScript, Prisma 5, Zod, JWT, bcrypt |
| **IA** | Python 3.12, FastAPI, LangGraph, Anthropic (`claude-sonnet-4-6` en el orquestador), Pinecone, Voyage AI `voyage-3` |
| **Datos** | PostgreSQL + PostGIS, Redis, Neo4j |
| **Blockchain** | Solidity `^0.8.24`, Hardhat, OpenZeppelin 5, Polygon |
| **Monorepo** | pnpm `10.34.5`, Turborepo 2 |
| **Observabilidad** | Sentry + health/readiness probes |
| **Deploy** | Vercel (web) + Railway (API/AI) |

---

## Capacidades recientes incorporadas

### Dashboard Functional Convergence

El dashboard dejó de ser una vista principalmente urbana y ahora funciona como centro de comando autenticado del ciudadano. Expone actividad personal, acciones pendientes y acceso operativo a los módulos principales.

### Expedientes cívicos

`/dashboard/workflows` mantiene el contexto de un caso cívico a través de los distintos módulos. Un reporte territorial puede analizarse con IA, convertirse en propuesta y/o escalarse a control público sin perder procedencia, ownership ni auditoría.

### Federación CTG One

VÉRTICE dispone de entrada `Continuar con CTG One` reutilizando el intercambio federado con PKCE. La sesión final sigue siendo propia de VÉRTICE y la vinculación no se realiza por mera coincidencia de correo.

### Autoridad por roles

Los privilegios ya no dependen de un rol estático embebido. Existen grants persistentes y un `active_role` de sesión; los roles privilegiados se validan contra la autoridad persistida. El dashboard incluye selector de rol y un panel `/dashboard/authority` reservado a superadmin.

### Gobernanza y democracia líquida

El padrón electoral se congela para cada propuesta al entrar en votación. El ledger canónico de participación evita doble influencia, preserva nullifiers opacos y coordina participación directa y delegada. La admisión electoral no se recalcula a partir de identidad mutable durante la ventana de voto.

---

## Inicio rápido

### Requisitos

- Node.js `>=20`
- pnpm `>=9` (lockfile actual generado con pnpm 10)
- Docker + Docker Compose
- Python 3.12 para `apps/ai`

### Instalación

```bash
git clone https://github.com/VladPhil92/Vertice-OS.git
cd Vertice-OS
pnpm install
cp .env.example .env
```

### Infraestructura local

```bash
docker compose up -d
pnpm --filter @vertice/api db:deploy
pnpm dev
```

Web: `http://localhost:3000`  
API: `http://localhost:4000`  
AI: `http://localhost:8001` cuando se ejecuta el servicio Python.

### Servicio IA

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

## Comandos principales

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck

pnpm --filter @vertice/api db:generate
pnpm --filter @vertice/api db:migrate
pnpm --filter @vertice/api db:deploy

pnpm --filter @vertice/contracts compile
pnpm --filter @vertice/contracts test
pnpm --filter @vertice/contracts deploy:amoy
```

---

## Documentación

- [`docs/CURRENT_STATE.md`](./docs/CURRENT_STATE.md) — snapshot funcional y límites conocidos.
- [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md) — arquitectura implementada y componentes opcionales.
- [`docs/governance/GOVERNANCE.md`](./docs/governance/GOVERNANCE.md) — reglas de gobernanza y contrato del ledger de participación.
- [`docs/security/CIVIC_IDENTITY_ASSURANCE.md`](./docs/security/CIVIC_IDENTITY_ASSURANCE.md) — frontera de confianza de identidad cívica.
- [`docs/integrations/CTG_ONE.md`](./docs/integrations/CTG_ONE.md) — federación VÉRTICE ↔ CTG One.
- [`docs/deployment/railway-vercel.md`](./docs/deployment/railway-vercel.md) — runtime y despliegue.

---

## Seguridad — invariantes actuales

- CTG One federation/SSO **no** constituye por sí sola assurance de identidad cívica.
- La allowlist `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` es explícita y fail-closed.
- El padrón congelado es la autoridad de admisión durante la ventana de votación.
- Los votos usan nullifiers; el sistema no debe enlazar públicamente identidad y sentido del voto.
- Los roles privilegiados deben validarse contra grants persistentes y sesión activa.
- El último superadmin no puede eliminarse.
- Secretos de CTG One, Anthropic, blockchain y otros proveedores nunca deben exponerse al browser.
- PostgreSQL y Redis son dependencias requeridas para readiness; Neo4j puede degradarse sin bloquear el arranque completo de la API.

---

## Contexto legal

VÉRTICE OS está diseñado como infraestructura de participación y control ciudadano. El módulo legal se apoya en mecanismos como derecho de petición, tutela y acciones populares, pero los documentos generados por IA requieren revisión del usuario y no constituyen representación jurídica automática.

Las decisiones agregadas de la plataforma son evidencia cívica y mecanismos consultivos; su fuerza jurídica depende del procedimiento institucional aplicable en Colombia.

---

## Créditos

**Fundador y Arquitecto de Producto:** Juan Pablo Valderrama Pino  
**Organización:** CTG One Corporation  
**Ciudad piloto:** Cartagena de Indias, Bolívar, Colombia

---

*VÉRTICE OS — infraestructura para la democracia continua.*

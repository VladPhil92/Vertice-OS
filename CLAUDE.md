# VÉRTICE OS — CLAUDE.md
# Memoria de Proyecto para Claude Code

> Este archivo es la fuente de verdad para Claude Code al trabajar en VÉRTICE OS.
> Claude Code lo lee automáticamente al iniciar en este directorio.
> Actualizar tras cada decisión arquitectónica importante.

---

## IDENTIDAD DEL PROYECTO

**Nombre:** VÉRTICE OS  
**Tipo:** Sistema Operativo Cívico — infraestructura de participación ciudadana  
**Ciudad Piloto:** Cartagena de Indias, Colombia  
**Organización:** CTG One Corporation  
**Repo:** https://github.com/VladPhil92/Vertice-OS  
**Versión actual:** 0.1.0-alpha  
**Fase actual:** FASE I — Fundación (Sprint 1-2)

---

## ARQUITECTURA DEL MONOREPO

```
vertice-os/
├── CLAUDE.md                    ← Estás aquí
├── .mcp.json                    ← Configuración GitHub MCP
├── .claude/
│   └── settings.json            ← Permisos y hooks de Claude Code
├── package.json                 ← Monorepo root (pnpm workspaces)
├── turbo.json                   ← Turborepo config
├── docker-compose.yml           ← Dev local completo
├── .env.example                 ← Variables de entorno documentadas
│
├── apps/
│   ├── web/                     ← Frontend Next.js 14 (puerto 3000)
│   │   ├── app/                 ← App Router
│   │   ├── components/          ← Componentes React
│   │   ├── lib/                 ← Utilidades y hooks
│   │   └── public/
│   │
│   ├── api/                     ← API Gateway GraphQL (puerto 4000)
│   │   ├── src/
│   │   │   ├── modules/         ← Módulos por dominio
│   │   │   ├── middleware/      ← Auth, rate limit, logging
│   │   │   └── schema/          ← GraphQL schema
│   │   └── prisma/              ← Schema Prisma ORM
│   │
│   └── ai/                      ← AI Orchestrator Python (puerto 8001)
│       ├── orchestrator.py      ← Multi-agente LangGraph (YA EXISTE)
│       ├── agents/              ← Agentes individuales
│       ├── rag/                 ← Pipeline RAG
│       └── requirements.txt     ← YA EXISTE
│
├── packages/
│   ├── ui/                      ← Design system compartido
│   ├── types/                   ← TypeScript types compartidos
│   └── config/                  ← Configs compartidas (ESLint, TS)
│
├── infrastructure/
│   ├── db/
│   │   └── init.sql             ← Schema PostgreSQL+PostGIS (YA EXISTE)
│   ├── terraform/               ← IaC AWS/GCP
│   └── kubernetes/              ← Manifiestos K8s
│
├── contracts/                   ← Smart contracts Solidity (Polygon)
│   ├── VotingRegistry.sol
│   └── CivicSBT.sol
│
└── docs/
    ├── architecture/
    │   └── ARCHITECTURE.md      ← YA EXISTE — leer antes de tocar infra
    └── governance/
        └── GOVERNANCE.md        ← YA EXISTE — leer antes de tocar gobernanza
```

---

## STACK TECNOLÓGICO DEFINITIVO

### Frontend (`apps/web/`)
- **Framework:** Next.js 14 con App Router (NO Pages Router)
- **Lenguaje:** TypeScript strict mode
- **Estilos:** Tailwind CSS — usar SOLO clases de `tailwind.config.ts` existente
- **Animaciones:** Framer Motion — cinematic, institucional
- **Mapas:** Mapbox GL JS + react-map-gl
- **Estado global:** Zustand (NO Redux, NO Context para estado global)
- **Fetching:** TanStack Query + Apollo Client (GraphQL)
- **Componentes base:** Radix UI primitives (NO instalar otras UI libs sin preguntar)
- **Fonts:** Syne (display) + DM Mono (mono) + Fraunces (serif) — YA CONFIGURADAS

### Backend (`apps/api/`)
- **Runtime:** Node.js 20+ con TypeScript
- **Framework:** Fastify 5 (NO Express) — migrado desde 4.x para poder usar
  `@fastify/jwt@10`, único que trae `fast-jwt >= 6.2.4` con los dos CVE
  críticos parchados (confusión de algoritmo JWT y colisión de caché que podía
  devolver claims de otro token). Los tests corren con
  `NODE_OPTIONS=--experimental-vm-modules` porque `@fastify/cookie@11` carga
  el paquete `cookie` con `import()` dinámico, que Jest en modo CJS no resuelve
  sin esa bandera.
- **API:** GraphQL con Apollo Federation
- **ORM:** Prisma para PostgreSQL
- **Auth:** JWT + PKCE, bcrypt para hashing
- **Validación:** Zod (NO Joi, NO yup)

### AI Service (`apps/ai/`)
- **Lenguaje:** Python 3.12
- **LLM:** Claude API — modelo `claude-sonnet-4-20250514` SIEMPRE
- **Orquestación:** LangGraph (YA implementado en orchestrator.py)
- **Framework API:** FastAPI
- **Linting:** ruff, mypy strict

### Bases de Datos
- **Principal:** PostgreSQL 16 + PostGIS (schema YA existe en infrastructure/db/init.sql)
- **Documentos:** MongoDB 7
- **Grafo:** Neo4j 5 (para reputación y detección de manipulación)
- **Vectores:** Pinecone (RAG pipeline)
- **Caché:** Redis 7

### Blockchain
- **Red:** Polygon PoS (testnet Mumbai para dev, mainnet para prod)
- **Lenguaje contratos:** Solidity ^0.8.24
- **Framework:** Hardhat
- **Indexación:** The Graph

---

## DESIGN SYSTEM — REGLAS CRÍTICAS

### Paleta de colores (NO cambiar sin autorización)
```css
--bg: #050508           /* Fondo principal */
--surface: #0c0c14      /* Superficies elevadas */
--gold: #C8A84B         /* Acento primario — VÉRTICE gold */
--red: #C0392B          /* Colombia rojo */
--navy: #1A2744         /* Colombia azul */
--cyan: #4ECDC4         /* Acento tecnológico */
--text-primary: #F0EDE8
--text-secondary: rgba(240,237,232,0.45)
--text-tertiary: rgba(240,237,232,0.22)
```

### Principios visuales
- Dark mode SIEMPRE — no hay light mode en v1
- Tipografía institucional: Syne para títulos, DM Mono para labels/código
- Geometría limpia, sin bordes redondeados excesivos
- Grid de fondo sutil (60px × 60px, rgba(255,255,255,0.025))
- El oro (#C8A84B) es el color de valor — usarlo con intención

### Componentes — convenciones
```tsx
// CORRECTO — componente con variantes tipadas
export interface ButtonProps {
  variant: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

// INCORRECTO — className strings sin sistema
<button className="bg-yellow-500 text-black px-4 py-2">
```

---

## CONVENCIONES DE CÓDIGO

### TypeScript
- **Strict mode SIEMPRE** — no usar `any`, usar `unknown` si es necesario
- **Interfaces sobre types** para objetos públicos
- **Enums** para valores discretos conocidos
- **Zod schemas** para validación en runtime

### Nombrado
```
Archivos:         kebab-case.ts / kebab-case.tsx
Componentes:      PascalCase
Hooks:            useCamelCase
Utilidades:       camelCase
Constantes:       UPPER_SNAKE_CASE
Tipos/Interfaces: PascalCase
```

### Estructura de componente React
```tsx
// 1. Imports (externos → internos → types)
// 2. Types/interfaces
// 3. Constantes del módulo
// 4. Componente (function declaration, NO arrow function para componentes principales)
// 5. Subcomponentes (si son pequeños y solo se usan aquí)
// 6. Export default al final
```

### Git — mensajes de commit (Conventional Commits)
```
feat(module):   Nueva funcionalidad
fix(module):    Corrección de bug
docs:           Documentación
style:          Formato sin lógica
refactor:       Refactoring sin nueva funcionalidad
test:           Tests
infra:          Infraestructura, CI/CD
chore:          Tareas de mantenimiento

Ejemplos:
  feat(identity): implement DID generation flow
  fix(territorial): correct PostGIS spatial index query
  docs(governance): add liquid democracy spec
  infra(docker): add Neo4j service to compose
```

### Branches
```
main          → producción (protegida, solo merge via PR)
develop       → integración (PR requerido)
feature/XXX   → nuevas funcionalidades
fix/XXX       → correcciones
infra/XXX     → infraestructura
docs/XXX      → documentación
```

---

## MÓDULOS — ESTADO Y PRIORIDADES

### Módulo 01 — Identidad Cívica Digital
- **Estado:** 🟢 Implementado (API completa — rutas, servicio, schema, tests)
- **Archivos clave:** `apps/api/src/modules/identity/`
- **Implementado:** DID generation (sin clave criptográfica falsa — `verificationMethod`
  se omite hasta tener un método real), cédula protegida con HMAC-SHA256 +
  `IDENTITY_PEPPER` (no SHA-256 sin sal), verificación de email, conexión de
  wallet con firma (Sign-In-with-Ethereum simplificado, `POST
  /identity/wallet/nonce` + verificación de firma), integración con reputación
- **Niveles de verificación (nombres honestos, no prometen más de lo que prueban):**
  `registrado` → `documento_declarado` (el ciudadano reintrodujo su propia
  cédula; NO valida contra ninguna fuente externa) → `contacto_verificado`
  (correo confirmado). `documento_declarado` habilita voto consultivo —
  ver nota de integridad electoral en Módulo 03.
- **Pendiente:** Verificación real de identidad (proveedor externo o revisión
  manual) antes de habilitar votación vinculante; deploy contratos en Polygon
  Amoy testnet

### Módulo 02 — Motor Territorial
- **Estado:** 🟢 Implementado (API + frontend completos)
- **Archivos clave:** `apps/api/src/modules/territorial/`, `apps/web/app/dashboard/reports/`
- **Implementado:** CRUD reportes, PostGIS nearby, filtros, estadísticas, mapa Mapbox, formulario con geolocalización, vista detalle

### Módulo 03 — Gobernanza y Decisión
- **Estado:** 🟢 Implementado (API + frontend completos)
- **Archivos clave:** `apps/api/src/modules/governance/`, `apps/web/app/dashboard/governance/`
- **Implementado:** Propuestas, 5 etapas (idea→draft→debate→voting→resultado), democracia líquida, delegaciones
- **Integridad electoral:**
  - **Un ciudadano = un voto.** `computeVoteWeight()` siempre devuelve 1.0 —
    ya no escala 1.0–1.5 según reputación. La reputación sigue existiendo
    para moderación/insignias, nunca para multiplicar el valor de un voto.
  - **Quórum territorial real.** Cada propuesta guarda un snapshot del
    barrio/localidad de su autor al crearse (`proposals.locality_id`,
    `proposals.neighborhood`). El universo de votantes elegibles se filtra
    por ese territorio cuando `scope = neighborhood/locality`; antes se
    contaba siempre a toda la ciudad sin importar el scope.
  - **Avales con fuente de verdad en Postgres.** `proposal_endorsements`
    (PK compuesta `proposal_id, citizen_id`) es la restricción real que
    impide el doble aval. Redis sigue usándose como caché, pero ya no es la
    guarda de duplicados — antes, si Redis perdía datos, un ciudadano podía
    volver a avalar sin límite.
  - **Nulificador de voto con clave propia** (`VOTE_NULLIFIER_SECRET`,
    distinta de `JWT_SECRET`) — rotar el secreto de sesión ya no invalida
    silenciosamente el historial de nulificadores.
  - **Aval + contador + avance de etapa son una sola transacción.**
    `endorseProposal()` usa `prisma.$transaction()` — antes eran 3 sentencias
    sueltas y una caída del proceso entre el INSERT y el UPDATE del contador
    desincronizaba el número mostrado del real.
  - **Cierre de votación idempotente.** El `UPDATE` que cierra una votación
    filtra por `WHERE status = 'voting'`; solo la solicitud que gana esa
    condición encola el registro on-chain y notifica — dos finalizaciones
    concurrentes ya no disparan el job ni la notificación por duplicado.
  - **Padrón congelado por consulta.** `proposal_voter_roll` guarda, en la
    misma transacción que el paso debate→voting, la lista nominal de
    ciudadanos elegibles (territorio, nivel de verificación, motivo). El
    `eligible_voters` de la propuesta es literalmente el número de filas
    insertadas ahí — no puede desincronizarse del padrón, y ahora se puede
    responder "¿quién podía votar?" después de los hechos.
  - **Auditoría de acciones de moderador.** `admin_audit_log` (solo INSERT)
    registra quién, qué acción, sobre qué propuesta, cuándo y con qué
    resultado para `adminAdvanceProposal`/`adminArchiveProposal` — ver
    `lib/audit.ts`.

### Módulo 04 — Capa IA Multi-Agente
- **Estado:** 🟢 Implementado
- **Archivos existentes:** `apps/ai/orchestrator.py` (LangGraph, 6 agentes), `apps/ai/rag/pipeline.py`, `apps/ai/main.py` (FastAPI)
- **Implementado:** RAG pipeline con Pinecone, rutas REST /ai/query y /rag/*, 28 tests de cobertura

### Módulo 05 — Blockchain
- **Estado:** 🟡 Contratos escritos y testeados, pendiente deploy
- **Contratos:** `contracts/contracts/CivicSBT.sol`, `contracts/contracts/VotingRegistry.sol`
- **Implementado:** 53 tests en Hardhat (26 CivicSBT + 27 VotingRegistry), todos pasan
- **Privacidad:** el DID **nunca** se escribe on-chain. El contrato guarda
  `didCommitment = keccak256(DID_COMMITMENT_PEPPER : did)`; el pepper es un
  secreto del backend y permanente por despliegue (rotarlo rompe el vínculo con
  los badges emitidos). Aplica también al `tokenURI`, que es público on-chain.
- **Pendiente:** Deploy en Polygon Amoy testnet, configurar secrets DEPLOYER_PRIVATE_KEY
  y DID_COMMITMENT_PEPPER. Antes de mainnet: multisig para `DEFAULT_ADMIN_ROLE`.
- **Mint y registro on-chain vía cola durable, no fire-and-forget.** El mint
  del badge de identidad y el registro de resultados de votación en
  `VotingRegistry` se encolan en la tabla `jobs` (Postgres) y los procesa un
  worker en el propio proceso de la API con reintentos y backoff exponencial
  (`apps/api/src/lib/jobs.ts`). Antes eran `.catch(() => null)`: si el proceso
  caía a mitad de camino, el mint o el registro se perdían en silencio, sin
  reintento ni rastro. `mintCitizenBadge()`/`recordProposalVoting()` ahora
  lanzan en error real (antes lo devoraban) — el job necesita distinguir un
  fallo real de un no-op legítimo (badge/registro ya existente) para saber
  cuándo reintentar.

### Módulo 06 — Reputación
- **Estado:** 🟢 Implementado (API + frontend completos)
- **Archivos clave:** `apps/api/src/modules/reputation/`, `apps/web/app/dashboard/reputation/`
- **Implementado:** Score acumulativo, eventos de reputación, Neo4j para grafo, UI con ring SVG, tabs Resumen/Actividad/Logros, badges

### Módulo 07 — Eventos en Tiempo Real (SSE)
- **Estado:** 🟢 Implementado y testeado
- **Archivos clave:** `apps/api/src/modules/events/`, `apps/api/src/lib/pubsub.ts`, `apps/web/lib/useServerEvents.ts`
- **Implementado:** SSE endpoint `/events`, Redis pub/sub, heartbeat 25s, reconexión exponencial frontend, publishers integrados en territorial y governance, 21 tests

### Frontend Landing
- **Estado:** 🟢 Implementado en Next.js App Router
- **Archivos:** `apps/web/app/page.tsx`, `apps/web/components/sections/` (Hero, HowItWorks, Modules, AI, Roadmap), Footer

### Dashboard Web
- **Estado:** 🟢 Implementado (diseño completo desde mockups)
- **Archivos:** `apps/web/app/dashboard/` (layout, panel, reputation, reports, governance, legal, admin, ai)
- **Implementado:** Sidebar desktop, bottom nav mobile con FAB dorado, datos reales de API, diseño dark gold

### Despliegue — Railway + Vercel
- **Estado:** 🟡 Configuración lista, sin desplegar todavía
- **Guía completa:** `docs/deployment/railway-vercel.md`
- **Servicios:** Railway para `apps/api` (Fastify + worker de jobs embebido),
  `apps/ai` (FastAPI) y Postgres+PostGIS/Redis; Vercel para `apps/web`.
  `railway.json` (raíz, para `api`) y `apps/ai/railway.json` apuntan cada uno
  a su Dockerfile y healthcheck (`/health/ready`).
- **`apps/api/Dockerfile` tenía 3 bugs reales, corregidos y verificados de
  punta a punta** (sin Docker daemon disponible en el entorno de desarrollo,
  pero replicando cada stage a mano): el stage `deps` fallaba siempre
  (`postinstall` de Prisma sin `schema.prisma` copiado), `@vertice/types` no
  se compilaba antes de `@vertice/api`, y la imagen final aplanaba
  `dist`+`node_modules` rompiendo los symlinks relativos de pnpm hacia
  `apps/api/node_modules` y `packages/types` — el contenedor habría muerto en
  el primer `require()`. `apps/ai/Dockerfile` también fijaba el puerto 8001
  en el `CMD`, incompatible con el `$PORT` que inyecta Railway.
- **Postgres necesita PostGIS explícito** — el plugin "PostgreSQL" por
  defecto de Railway no lo trae; usar la plantilla de extensiones o la
  dedicada de PostGIS (enlaces en la guía). Verificado contra un Postgres 16
  real: sin PostGIS la primera migración aborta con `0A000`.
- **`/health/ready` distingue dependencias requeridas de opcionales.**
  Postgres y Redis caídos → 503 (`status: "unavailable"`). Neo4j caído → 200
  con `status: "degraded"`. Antes Neo4j contaba como requerido, así que el
  healthcheck del despliegue devolvía 503 para siempre en el piloto (que
  excluye Neo4j a propósito) y la plataforma mataba el contenedor por
  "1/1 replicas never became healthy" — era imposible desplegar.

---

## REGLAS DE SEGURIDAD — NUNCA VIOLAR

1. **NUNCA** commitear archivos `.env` — solo `.env.example`
2. **NUNCA** almacenar cédulas en texto plano — solo HMAC-SHA256 con `IDENTITY_PEPPER`
   (SHA-256 sin sal es enumerable por fuerza bruta dado el espacio pequeño de
   cédulas colombianas; ver `apps/api/src/lib/identity-hash.ts`)
3. **NUNCA** exponer `ANTHROPIC_API_KEY` en el frontend (solo backend/AI service)
4. **NUNCA** usar `eval()` o inputs sin sanitizar en SQL
5. **NUNCA** hardcodear private keys de blockchain
6. **SIEMPRE** usar Prisma para queries SQL (no SQL raw salvo excepciones PostGIS)
7. **SIEMPRE** validar con Zod antes de procesar input externo
8. **SIEMPRE** usar HTTPS/WSS en producción

---

## COMANDOS FRECUENTES

```bash
# Desarrollo local completo
docker-compose up -d          # Levantar todos los servicios
pnpm dev                       # Levantar apps en paralelo (Turborepo)

# Solo frontend
cd apps/web && pnpm dev

# Solo AI service
cd apps/ai && uvicorn main:app --reload --port 8001

# Base de datos
psql postgresql://vertice:vertice@localhost:5432/vertice_os

# Tests
pnpm test                      # Todos los workspaces
pnpm --filter @vertice/web test

# Lint y typecheck
pnpm lint
pnpm typecheck

# Build
pnpm build
```

---

## WORKFLOW DE DESARROLLO CON GITHUB

### Para cada tarea nueva:
```bash
# 1. Crear branch desde develop
git checkout develop
git pull origin develop
git checkout -b feature/nombre-descriptivo

# 2. Desarrollar con commits frecuentes
git add .
git commit -m "feat(module): descripción clara"

# 3. Push y crear PR
git push origin feature/nombre-descriptivo
# → Crear PR en GitHub apuntando a develop
# → El CI/CD (GitHub Actions) corre automáticamente

# 4. Merge solo cuando CI pasa
```

### GitHub Issues — cómo trabajarlos:
- Leer el issue completo antes de empezar
- Crear branch con el número del issue: `feature/007-did-generation`
- Linkear el PR al issue: "Closes #007" en la descripción del PR

---

## CONTEXTO DE NEGOCIO (leer para entender el propósito)

VÉRTICE OS no es una app política más. Es **infraestructura cívica** —
la diferencia es que una app política depende de un ciclo electoral y 
VÉRTICE opera permanentemente, acumula inteligencia territorial y 
se convierte en el substrato de la vida democrática de Cartagena.

**Ciudad piloto:** Cartagena de Indias, Bolívar, Colombia  
**Problema central:** Desconexión entre ciudadanos e instituciones  
**Solución:** Participación continua + IA + transparencia radical  

**Filosofía fundacional:**  
> "La política no debería ocurrir solo cada cuatro años."

**Usuarios objetivo (Fase I):**
- Ciudadanos de Cartagena con cédula verificada
- Líderes comunitarios de JACs y organizaciones civiles
- Concejales y funcionarios que quieran canales directos

---

## DECISIONES ARQUITECTÓNICAS TOMADAS

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Next.js App Router | Pages Router | Server Components para performance |
| Fastify | Express | 2-3x más rápido, mejor TypeScript support |
| Zustand | Redux | Mucho más simple para este caso |
| LangGraph | LangChain básico | Necesitamos grafos de agentes con estado |
| Polygon PoS | Ethereum mainnet | Gas fees inaccesibles para usuarios colombianos |
| Soulbound Tokens | Governance tokens transferibles | Anti-clientelismo: la reputación no se vende |
| PostGIS | MongoDB geoespacial | Queries espaciales complejos requieren PostGIS |
| Pinecone | pgvector | Escala sin configurar infraestructura GPU propia |

---

## CONTACTO Y REFERENCIAS

- **Arquitecto del producto:** Juan Pablo Valderrama Pino (CTG One Corporation)
- **Documentación arquitectura:** `docs/architecture/ARCHITECTURE.md`
- **Marco de gobernanza:** `docs/governance/GOVERNANCE.md`
- **Roadmap completo:** `README.md`
- **Stack de IA:** `apps/ai/orchestrator.py` + `apps/ai/requirements.txt`
- **Schema DB:** `infrastructure/db/init.sql`

---

*Este archivo debe actualizarse cada vez que se toma una decisión que afecta
la arquitectura, el stack, o las convenciones del proyecto.*

*Última actualización: v0.1.0 — Fase I Sprint 1*

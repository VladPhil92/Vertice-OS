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
- **Framework:** Fastify (NO Express)
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
- **Implementado:** DID generation, verificación de cédula (SHA-256), verificación de email, niveles de verificación 0–3, integración con reputación
- **Pendiente:** Deploy contratos en Polygon Amoy testnet

### Módulo 02 — Motor Territorial
- **Estado:** 🟢 Implementado (API + frontend completos)
- **Archivos clave:** `apps/api/src/modules/territorial/`, `apps/web/app/dashboard/reports/`
- **Implementado:** CRUD reportes, PostGIS nearby, filtros, estadísticas, mapa Mapbox, formulario con geolocalización, vista detalle

### Módulo 03 — Gobernanza y Decisión
- **Estado:** 🟢 Implementado (API + frontend completos)
- **Archivos clave:** `apps/api/src/modules/governance/`, `apps/web/app/dashboard/governance/`
- **Implementado:** Propuestas, 5 etapas (idea→draft→debate→voting→resultado), democracia líquida, delegaciones, quórum configurable por alcance, avales

### Módulo 04 — Capa IA Multi-Agente
- **Estado:** 🟢 Implementado
- **Archivos existentes:** `apps/ai/orchestrator.py` (LangGraph, 6 agentes), `apps/ai/rag/pipeline.py`, `apps/ai/main.py` (FastAPI)
- **Implementado:** RAG pipeline con Pinecone, rutas REST /ai/query y /rag/*, 28 tests de cobertura

### Módulo 05 — Blockchain
- **Estado:** 🟡 Contratos escritos y testeados, pendiente deploy
- **Contratos:** `contracts/contracts/CivicSBT.sol`, `contracts/contracts/VotingRegistry.sol`
- **Implementado:** 53 tests en Hardhat (26 CivicSBT + 27 VotingRegistry), todos pasan
- **Pendiente:** Deploy en Polygon Amoy testnet, configurar secrets DEPLOYER_PRIVATE_KEY

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

---

## REGLAS DE SEGURIDAD — NUNCA VIOLAR

1. **NUNCA** commitear archivos `.env` — solo `.env.example`
2. **NUNCA** almacenar cédulas en texto plano — solo SHA-256 hash
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

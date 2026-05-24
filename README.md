# VÉRTICE OS

> **Sistema Operativo Cívico — Cartagena de Indias, Colombia**  
> *Infraestructura permanente para la democracia continua.*

[![Estado](https://img.shields.io/badge/Estado-Alpha%20v0.1.0-C8A84B?style=flat-square)](https://github.com/VladPhil92/Vertice-OS)
[![CI](https://img.shields.io/github/actions/workflow/status/VladPhil92/Vertice-OS/ci.yml?style=flat-square&label=CI)](https://github.com/VladPhil92/Vertice-OS/actions)
[![Licencia](https://img.shields.io/badge/Licencia-Propietaria-1A2744?style=flat-square)](./LICENSE)
[![Ciudad Piloto](https://img.shields.io/badge/Piloto-Cartagena%20de%20Indias-C0392B?style=flat-square)](https://es.wikipedia.org/wiki/Cartagena_de_Indias)

---

## ¿Qué es VÉRTICE OS?

VÉRTICE OS es infraestructura cívica de nueva generación — no una aplicación política, sino el **substrato permanente** de la vida democrática de una ciudad. Los ciudadanos reportan problemas en su territorio, proponen y votan políticas públicas, delegan su voto en quien confían, y acumulan reputación cívica verificada on-chain. La IA sirve de mediadora y sintetizadora; la blockchain garantiza la inmutabilidad de cada decisión.

> *"La política no debería ocurrir solo cada cuatro años."*

---

## Estado de implementación

| # | Módulo | Estado | Descripción |
|---|--------|--------|-------------|
| 01 | **Identidad Cívica Digital** | ✅ Implementado | DID W3C, verificación cédula/email, 3 niveles |
| 02 | **Motor Territorial** | ✅ Implementado | Reportes PostGIS, clustering, análisis IA |
| 03 | **Gobernanza y Decisión** | ✅ Implementado | Propuestas, votación ponderada, delegación líquida |
| 04 | **Capa IA Multi-Agente** | ✅ Implementado | LangGraph, 6 agentes, RAG Pinecone + Voyage AI |
| 05 | **Blockchain & Confianza** | ✅ Implementado | CivicSBT (ERC-5192), VotingRegistry, Polygon Amoy |
| 06 | **Reputación Cívica** | ✅ Implementado | Neo4j, eventos, niveles observador→embajador |
| 07 | **Legal Ciudadano** | ✅ Implementado | Generador IA de derechos de petición, tutelas, etc. |

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                  apps/web  (Next.js 14 — :3000)              │
│  Landing · Dashboard · Identidad · Reportes · Gobernanza     │
│           Reputación · Legal · Design System                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ GraphQL / REST
┌───────────────────────────▼──────────────────────────────────┐
│                  apps/api  (Fastify — :4000)                  │
│  auth · identity · territorial · governance · reputation     │
│  legal ── Prisma ORM ── PostgreSQL 16 + PostGIS              │
└──────┬────────────────────┬───────────────────┬──────────────┘
       │                    │                   │
   Redis 7            Neo4j 5.21         apps/ai (FastAPI — :8001)
  (caché/sessions)    (reputación)       LangGraph · 6 agentes
                                         RAG Pinecone + Voyage AI
┌──────────────────────────────────────────────────────────────┐
│              contracts/  (Polygon PoS — Amoy testnet)        │
│        CivicSBT (ERC-5192 Soulbound) · VotingRegistry       │
└──────────────────────────────────────────────────────────────┘
```

---

## Stack

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Next.js 14 App Router, TypeScript strict, Tailwind CSS, Framer Motion, Mapbox GL |
| **Backend** | Fastify 4, TypeScript, Prisma ORM, Zod validation, JWT + bcrypt |
| **IA** | Claude claude-sonnet-4-20250514, LangGraph, FastAPI, Voyage AI voyage-3, Pinecone |
| **DB principal** | PostgreSQL 16 + PostGIS 3.4 |
| **Caché** | Redis 7 |
| **Grafo** | Neo4j 5.21 (reputación y detección de manipulación) |
| **Blockchain** | Polygon PoS, Solidity ^0.8.24, Hardhat, OpenZeppelin 5 |
| **Infra** | Docker Compose (dev), Kubernetes (prod), Terraform (AWS EKS + RDS) |
| **CI/CD** | GitHub Actions: lint → typecheck → test → build → deploy |

---

## Inicio rápido (desarrollo local)

### Prerequisitos
- Node.js ≥ 20, pnpm ≥ 10
- Docker + Docker Compose
- Python 3.12 (para el servicio AI)

### 1. Clonar e instalar

```bash
git clone https://github.com/VladPhil92/Vertice-OS.git
cd Vertice-OS
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores (ver secciones comentadas)
# Mínimo requerido para desarrollo:
#   POSTGRES_PASSWORD, JWT_SECRET, ANTHROPIC_API_KEY
```

### 3. Levantar infraestructura

```bash
docker-compose up -d   # PostgreSQL + PostGIS, Redis, Neo4j
```

### 4. Aplicar migraciones y arrancar

```bash
pnpm --filter @vertice/api db:deploy    # Crea las 9 tablas + seed de localidades
pnpm dev                                # Arranca web (:3000), api (:4000) en paralelo
```

### 5. Servicio IA (opcional)

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

## Estructura del monorepo

```
vertice-os/
├── apps/
│   ├── web/                    # Next.js 14 — App Router
│   │   └── app/dashboard/      # 9 páginas del panel ciudadano
│   ├── api/                    # Fastify — 6 módulos con tests
│   │   ├── src/modules/        # auth · identity · territorial · governance · reputation · legal
│   │   └── prisma/             # Schema + migración inicial
│   └── ai/                     # FastAPI — orquestador LangGraph
│       ├── orchestrator.py     # 6 agentes IA
│       ├── rag.py              # Pipeline RAG Pinecone + Voyage AI
│       └── scripts/            # index_documents.py para Cartagena
├── packages/
│   ├── types/                  # @vertice/types — interfaces TypeScript compartidas
│   ├── ui/                     # @vertice/ui — 8 componentes design system
│   └── config/                 # @vertice/config — TSConfig + ESLint bases
├── contracts/                  # Solidity ^0.8.24 — Polygon PoS
│   ├── contracts/              # CivicSBT.sol · VotingRegistry.sol
│   ├── test/                   # Tests Hardhat/Chai
│   └── scripts/deploy.ts       # Deploy + verificación Polygonscan
├── infrastructure/
│   ├── db/                     # init_extensions.sql (PostGIS)
│   ├── kubernetes/             # Manifiestos K8s por servicio
│   └── terraform/              # IaC AWS: EKS · RDS · ElastiCache · VPC
├── docs/
│   ├── architecture/ARCHITECTURE.md
│   └── governance/GOVERNANCE.md
├── docker-compose.yml          # Dev local completo
├── turbo.json                  # Turborepo pipeline
└── .github/workflows/ci.yml   # CI/CD: calidad → tests → build → deploy
```

---

## Comandos frecuentes

```bash
# Desarrollo
pnpm dev                                    # Todos los apps en paralelo
pnpm --filter @vertice/web dev              # Solo frontend
pnpm --filter @vertice/api dev              # Solo API

# Base de datos
pnpm --filter @vertice/api db:generate      # Regenerar Prisma client
pnpm --filter @vertice/api db:migrate       # Crear nueva migración
pnpm --filter @vertice/api db:deploy        # Aplicar migraciones
pnpm --filter @vertice/api db:studio        # Prisma Studio

# Tests
pnpm test                                   # Todos los workspaces
pnpm --filter @vertice/api test             # Solo API (Jest, ~210 tests)

# Smart contracts
pnpm --filter @vertice/contracts compile    # Compilar + typechain
pnpm --filter @vertice/contracts test       # Tests Hardhat
pnpm --filter @vertice/contracts deploy:amoy  # Deploy a Polygon Amoy

# Indexar documentos cívicos (RAG)
cd apps/ai
python scripts/index_documents.py \
  --source docs/plan-desarrollo.txt \
  --doc-type plan \
  --locality CTG-01

# Infraestructura
cd infrastructure/terraform
terraform init -backend-config=backend.tfvars
terraform plan
terraform apply

kubectl apply -k infrastructure/kubernetes/
```

---

## Pipeline CI/CD

```
push → quality (lint + typecheck TypeScript/Python)
     → test (Jest + pytest con PostgreSQL + Redis + Neo4j)
     → security (semgrep + audit)
     → build (Next.js + Docker)
     → deploy:staging (rama develop)
     → deploy:production (rama main, aprobación manual)
```

---

## Agentes IA

| Agente | Función |
|--------|---------|
| **Router** | Orquestador — clasifica la intención y delega al agente correcto |
| **Ciudadano** | Responde preguntas cívicas, guía participación |
| **Gobernanza** | Sintetiza debates, identifica consenso en propuestas |
| **Política** | Convierte demandas ciudadanas en borradores de política pública |
| **Territorial** | Analiza patrones en reportes por barrio/localidad |
| **Integridad** | Detecta bots, coordinación inauténtica y desinformación |
| **Legal** | Genera documentos jurídicos (tutelas, derechos de petición, etc.) |

---

## Seguridad

- Cédulas almacenadas **solo como hash SHA-256** — nunca en texto plano
- JWT de corta vida (15 min) + refresh tokens con rotación
- Rate limiting por Redis en todos los endpoints
- `ANTHROPIC_API_KEY` solo en el backend/AI — nunca expuesta al frontend
- Semgrep SAST en CI (TypeScript + Python + secrets)
- Votos con nullifier hash — privacidad ante correlación on-chain
- Soulbound Tokens no transferibles — la reputación no se vende

---

## Contexto legal (Colombia)

- **Art. 23 CP** — Derecho de petición (Módulo Legal)
- **Art. 86 CP** — Acción de tutela (Módulo Legal)
- **Ley 1581/2012** — Habeas data / protección de datos personales
- **Ley 472/1998** — Acciones populares (Módulo Legal)
- Los procesos de votación son **consultas ciudadanas**, no actos administrativos vinculantes

---

## Créditos

**Fundador y Arquitecto de Producto:** Juan Pablo Valderrama Pino  
**Organización:** CTG One Corporation  
**Ciudad Piloto:** Cartagena de Indias, Bolívar, Colombia

---

*VÉRTICE OS — Infraestructura para la democracia continua.*

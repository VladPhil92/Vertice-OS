# Arquitectura Técnica — VÉRTICE OS

> Arquitectura implementada · snapshot 2 de septiembre de 2026  
> Cartagena de Indias, Colombia

Este documento describe el **runtime que existe hoy**. Los componentes futuros se marcan explícitamente como planeados; no deben confundirse con dependencias operativas.

---

## 1. Topología actual

```text
┌──────────────────────────────────────────────────────────────┐
│                    CLIENTE WEB / PWA                         │
│                  apps/web — Next.js 15                      │
│                                                              │
│ Dashboard · Identity · Reports · Governance · Legal · AI     │
│ Workflows · Reputation · Authority · Notifications           │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼───────────────────────────────────┐
│                    apps/api — Fastify 5                      │
│                                                              │
│ auth · dashboard · identity · territorial · governance       │
│ reputation · legal · ai · workflows · notifications · events│
└──────────────┬────────────────┬───────────────────┬───────────┘
               │                │                   │
               │                │                   └── Neo4j
               │                │                       reputación/grafo
               │                └── Redis
               │                    sesiones/cache/rate-limit/pubsub
               └── PostgreSQL 16 + PostGIS
                   estado canónico + geodatos + ledger cívico

                           │ HTTP interno
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    apps/ai — FastAPI                         │
│ LangGraph · 7 agentes · Claude · Pinecone · Voyage AI       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ contracts/ — Solidity ^0.8.24 + Hardhat                     │
│ CivicSBT · VotingRegistry · Polygon / Amoy                  │
└──────────────────────────────────────────────────────────────┘
```

### Contrato de transporte

La API activa es **REST sobre Fastify**. No existe un gateway GraphQL/Apollo Federation operativo en `apps/api/src/app.ts`; por tanto, GraphQL no debe presentarse como la interfaz canónica actual.

---

## 2. Aplicación web

**Ruta:** `apps/web`  
**Framework:** Next.js 15.5.23 + React 18  
**Deploy:** Vercel

### Superficies principales

- `/dashboard` — centro de comando `Mi VÉRTICE`;
- `/dashboard/identity` — identidad y assurance;
- `/dashboard/reports` — reportes territoriales;
- `/dashboard/proposals` y `/dashboard/governance` — propuestas y decisión colectiva;
- `/dashboard/legal` — control público / legal;
- `/dashboard/ai` — interacción con IA cívica;
- `/dashboard/reputation` — reputación;
- `/dashboard/workflows` — expedientes cívicos cross-module;
- `/dashboard/authority` — autoridad de roles para superadmin;
- `/dashboard/admin` — herramientas administrativas existentes.

### Estado y datos

- TanStack Query para fetching/caching de cliente;
- Zustand para estado global;
- Mapbox/react-map-gl para territorio;
- SSE para eventos en tiempo real;
- Sentry para observabilidad.

---

## 3. API

**Ruta:** `apps/api`  
**Runtime:** Node.js 20+  
**Framework:** Fastify 5.11.2  
**ORM:** Prisma 5  
**Deploy:** Railway

`apps/api/src/app.ts` registra actualmente:

```text
/auth
/dashboard
/identity
/territorial
/governance
/reputation
/legal
/ai
/workflows
/notifications
/events (SSE)
```

### Readiness

`GET /health/ready` distingue dependencias requeridas y degradables:

- PostgreSQL: requerido;
- Redis: requerido;
- Neo4j: opcional/degradable.

La caída de Neo4j no debe impedir por sí sola que la API arranque; la ausencia de PostgreSQL o Redis sí.

### Runtime productivo

El Dockerfile es la fuente de verdad del entrypoint. La secuencia esperada es:

1. arrancar el contenedor;
2. ejecutar migraciones Prisma;
3. bajar privilegios para el proceso Node de larga duración;
4. exponer readiness;
5. Railway usa el healthcheck configurado y no debe redefinir un `startCommand` divergente.

---

## 4. Datos

### PostgreSQL + PostGIS

Base canónica para:

- ciudadanos;
- sesiones y grants persistentes relacionados con autoridad;
- identidades externas;
- localidades y geodatos;
- reportes;
- propuestas;
- padrón electoral congelado;
- votos y ledger de participación;
- delegaciones;
- expedientes cívicos;
- documentos/acciones legales;
- notificaciones y auditoría según el dominio.

### Redis

Usos activos:

- cache;
- rate limiting;
- sesiones/estado efímero;
- pub/sub para eventos en tiempo real.

### Neo4j

Usado para capacidades de reputación/grafo. No es la autoridad primaria de identidad ni de votación.

### Bases no activas como requisito

MongoDB aparecía en diseños tempranos. No es una dependencia obligatoria del runtime actual y no debe figurar como parte necesaria del stack hasta que exista una integración real.

---

## 5. Identidad, autenticación y autorización

### 5.1 Autenticación local

- JWT;
- bcrypt;
- cookies/sesiones propias de VÉRTICE;
- refresh/session semantics definidas por el módulo de auth.

### 5.2 Federación CTG One

La federación usa un flujo explícito y server-side con PKCE/intercambio corto. VÉRTICE emite su propia sesión.

Invariantes:

- no compartir cookies mediante `Domain=.ctgone.com`;
- no transportar tokens en query strings/fragments;
- no asumir identidad por compartir dominio;
- no vincular una cuenta por mera coincidencia de email;
- `ctg_one` federation no equivale a civic identity assurance.

### 5.3 Civic identity assurance

`CIVIC_IDENTITY_ASSURANCE_PROVIDERS` contiene los providers aprobados para proofing fuerte de identidad cívica.

La allowlist vacía es fail-closed.

Al abrir una votación, el sistema construye un padrón congelado usando las reglas de assurance vigentes para esa transición. Durante la ventana de voto, ese snapshot se convierte en la autoridad electoral estable.

### 5.4 Roles y autoridad

Modelo actual:

```text
persistent grants: citizen | moderator | admin | superadmin
session.active_role
JWT.sid → sesión
privileged request → validación de grant persistente
```

Capacidades:

- cambio de rol activo por sesión;
- panel de autoridad;
- bootstrap controlado del primer superadmin;
- nuevos superadmins concedidos dentro de VÉRTICE;
- protección del último superadmin;
- audit trail append-only para eventos de autoridad.

---

## 6. Motor territorial y expedientes cívicos

### Reportes

El módulo territorial persiste reportes georreferenciados y sirve superficies de mapa/análisis. El ciudadano puede operar sobre reportes propios desde el dashboard.

### Expediente cívico

`civic_cases` une dominios antes aislados:

```text
Reporte
  ↓
Análisis IA
  ↓
Propuesta
  ↓
Deliberación / Votación / Decisión
  ↓
Control público / Acción legal
```

El workflow conserva:

- source report;
- citizen ownership;
- outputs y audit IDs de IA;
- proposal linkage;
- legal/public-control linkage;
- etapa derivada desde estados canónicos downstream.

No se deben duplicar puntos de reputación por acciones que ya generan un evento canónico en su módulo original.

---

## 7. Gobernanza y ledger electoral

### Padrón congelado

Antes de aceptar votos, la propuesta debe poseer un `proposal_voter_roll` válido. El sistema falla cerrado si el padrón no existe.

La elegibilidad durante la votación se lee del snapshot, no de un conjunto mutable de identidades externas.

### Delegaciones

Scopes soportados:

- `general`;
- `domain`;
- `proposal`.

La resolución respeta:

- validez temporal;
- precedencia `proposal > domain > general`;
- pertenencia al padrón de la propuesta.

### Ledger canónico

El contrato de participación debe garantizar:

- un participante no ejerce doble influencia directa/delegada;
- los nullifiers permanecen opacos;
- una participación delegada puede ser reemplazada por voto directo del ciudadano sin crear una segunda voz;
- tallies y `total_votes` representan participantes durables, no simplemente requests HTTP;
- el quórum usa el mismo universo conceptual que la admisión electoral.

No volver a implementar validaciones de admisión duplicadas en la ruta HTTP; la lógica electoral debe permanecer centralizada.

---

## 8. Servicio de IA

**Ruta:** `apps/ai`  
**Framework:** FastAPI  
**Orquestación:** LangGraph

Agentes implementados:

1. CitizenAgent
2. GovernanceAgent
3. PolicyAgent
4. TerritorialAgent
5. IntegrityAgent
6. CommsAgent
7. LegalAgent

El `BaseAgent.MODEL` actual es `claude-sonnet-4-6`.

### RAG

Pipeline activo cuando existen credenciales:

```text
consulta
  ↓
Voyage AI voyage-3 embedding
  ↓
Pinecone similarity search
  ↓
fragmentos relevantes
  ↓
agente LangGraph / Claude
```

Sin configuración de Pinecone/Voyage, el servicio debe degradarse de forma controlada; el fallback hash evita crash pero no debe presentarse como retrieval semántico equivalente.

---

## 9. Blockchain

**Ruta:** `contracts`  
**Tooling:** Solidity ^0.8.24, Hardhat, OpenZeppelin 5

Contratos presentes:

- `CivicSBT`;
- `VotingRegistry`.

Scripts disponibles:

- local;
- Polygon Amoy;
- Polygon mainnet.

Clasificación arquitectónica: **código implementado, activación on-chain dependiente del entorno**.

### Uso permitido

- evidencia inmutable de resultados;
- atestaciones/compromisos donde exista justificación;
- hashes y referencias de artefactos públicos.

### Uso prohibido

- PII;
- cédula en claro;
- email en claro;
- sentido individual del voto;
- secretos o credenciales.

---

## 10. Componentes planeados o retirados del contrato actual

Los siguientes conceptos no deben figurar como “implementados” sin cambios verificables en código:

- Apollo Federation / GraphQL gateway;
- microservicio de gobernanza en Go;
- Kafka como event bus obligatorio;
- MongoDB como datastore requerido;
- The Graph como indexador productivo requerido;
- integración certificada con Registraduría;
- biometría/liveness productivos;
- VC wallet como requisito operativo;
- DAO productiva.

---

## 11. Regla de mantenimiento documental

Cuando un PR cambie arquitectura, actualizar simultáneamente:

1. `README.md`;
2. `docs/CURRENT_STATE.md`;
3. este documento;
4. el documento de dominio afectado;
5. `CLAUDE.md` si el cambio altera una regla que futuros agentes deben respetar.

La documentación arquitectónica debe describir primero el sistema **existente** y separar después la evolución futura.

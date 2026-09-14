# VÉRTICE OS — CLAUDE.md
# Memoria de proyecto para agentes de desarrollo

> Este archivo es una guía operativa para trabajar en VÉRTICE OS.  
> **Fuente de verdad de estado:** `README.md` + `docs/CURRENT_STATE.md` + código actual.  
> Snapshot: **2 de septiembre de 2026**.

---

## IDENTIDAD DEL PROYECTO

**Nombre:** VÉRTICE OS  
**Tipo:** Sistema Operativo Cívico / infraestructura de participación ciudadana  
**Ciudad piloto:** Cartagena de Indias, Colombia  
**Organización:** CTG One Corporation  
**Repo:** `VladPhil92/Vertice-OS`  
**Versión de paquetes:** `0.1.0`  
**Estado funcional:** desarrollo activo / convergencia pre-piloto

No describir el producto como “Fase I / Sprint 1-2”. El repositorio ya incluye convergencia del dashboard ciudadano, workflows cross-module, federación CTG One, authority roles, civic identity assurance P0 y ledger canónico de democracia líquida.

---

## REGLA PRINCIPAL

**Documentar e implementar el sistema que existe, no una arquitectura aspiracional antigua.**

Antes de introducir una tecnología o afirmar que una capa existe, comprobar el código actual.

No asumir como runtime activo:

- GraphQL/Apollo Federation;
- un Governance Engine en Go;
- MongoDB obligatorio;
- Kafka obligatorio;
- The Graph obligatorio;
- Registraduría/KYC/liveness productivos;
- DAO productiva;
- ZKP productivo para cada voto.

---

## ARQUITECTURA ACTUAL

```text
apps/web — Next.js 15.5.23 / React 18 / Vercel
   │
   │ HTTPS / REST
   ▼
apps/api — Fastify 5.11.2 / TypeScript / Railway
   ├── PostgreSQL + PostGIS
   ├── Redis
   ├── Neo4j (degradable)
   └── apps/ai — FastAPI / LangGraph / Railway

contracts — Solidity / Hardhat / Polygon
```

### API

La API canónica actual es **REST**. `apps/api/src/app.ts` registra:

- `/auth`
- `/dashboard`
- `/identity`
- `/territorial`
- `/governance`
- `/reputation`
- `/legal`
- `/ai`
- `/workflows`
- `/notifications`
- `/events` / SSE

No introducir una segunda lógica de autorización o admisión en rutas si ya existe un servicio canónico de dominio.

---

## FRONTEND — `apps/web`

### Stack

- Next.js 15.5.23, App Router
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Mapbox GL / react-map-gl
- TanStack Query
- Zustand
- Radix UI primitives
- Sentry
- Playwright para E2E

### Superficies del dashboard

- `/dashboard` — `Mi VÉRTICE`
- `/dashboard/identity`
- `/dashboard/reports`
- `/dashboard/proposals`
- `/dashboard/governance`
- `/dashboard/legal`
- `/dashboard/ai`
- `/dashboard/reputation`
- `/dashboard/workflows`
- `/dashboard/authority`
- `/dashboard/admin`

No volver a convertir `/dashboard` en una simple vista de analytics urbanos. Debe seguir siendo el centro operacional autenticado del ciudadano.

### Design system

**Fuente de verdad canónica:** `packages/design-tokens/src/index.ts` (objeto `colors`/`moduleColors`/`typography`, en TypeScript, no CSS). Ningún componente nuevo (web o mobile) debe definir colores de marca, tipografía o spacing directamente. `apps/mobile/theme/vertice.ts` es el adaptador nativo real en uso (importa `index.ts` directamente y añade alias de fuente/imagery/elevation); `packages/design-tokens/src/native.ts` existe como export adicional del paquete pero **no** es el que consume la app hoy — no documentarlo como el adaptador activo hasta que se migre. `apps/web` puede usar `web.ts` → `cssVariables()`, que expone un subconjunto con prefijo `--color-*`/`--mod-*` (ver tabla abajo); no inventar nombres de variable CSS fuera de esa función.

Tema institucional activo (claro, no oscuro) — claves TS de `colors` en `index.ts`:

```ts
colors.background   // #F7F9FC
colors.surface       // #FFFFFF
colors.surfaceAlt    // #F0F4F9
colors.border        // #E1E7EF
colors.navy          // #0A2A66   — identidad/institución
colors.navyLight     // #163F86
colors.citizen       // #F5B700   — acción ciudadana
colors.citizenDark   // #D98B00
colors.red           // #D72638   — reservado para alertas críticas/seguridad
colors.azure         // #4A90E2
colors.emerald       // #2BA745
colors.cyan          // #178C8C
colors.textPrimary   // #0A2A66
colors.textSecondary // #4B5870
colors.textMuted     // #9AA6B5
```

Equivalentes CSS realmente exportados por `web.ts::cssVariables()` (subconjunto, prefijo obligatorio): `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-border-active`, `--color-navy`, `--color-navy-light`, `--color-citizen`, `--color-red`, `--color-azure`, `--color-emerald`, `--color-cyan`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--mod-*` (8 dominios), `--radius-md`, `--space-lg`, `--font-display-name`, `--font-body-name`. No todos los tokens TS tienen equivalente CSS hoy (p. ej. `citizenDark`, `textMuted`, la escala completa de radius/spacing, las paletas semánticas de banners) — si un componente web los necesita, ampliar `cssVariables()` en vez de inventar el nombre de variable.

Semántica de banners (info/success/warning/error) y 8 `moduleColors` por dominio cívico (mobility, water, security, health, education, services, culture, economy) también viven en `colors`/`moduleColors` de `packages/design-tokens` — consultar el archivo antes de introducir un color nuevo.

Tipografía: `display` = Montserrat (headings, 500–800), `body` = Inter (400–800), `mono` = DM Mono (datos técnicos), `serif` = Fraunces (solo editorial).

Logo canónico: `apps/web/public/brand/` (`vertice-wordmark.webp`, `vertice-logo.png`, `vertice-symbol.webp`) vía `BrandLogo.tsx`, copiado byte-a-byte a `apps/mobile/assets/brand/`. Reglas de uso en `docs/product/BRAND_ASSET_POLICY.md`.

No usar los activos de `apps/web/public/brand/` fuera de `BrandLogo.tsx`, ni recrear el logo como texto/SVG suelto: un asset huérfano así (`apps/web/public/logo.svg`) existió en este repo, violaba esa regla y usaba los colores del tema oscuro obsoleto (`#C8A84B`, `#F0EDE8`) — ya fue eliminado.

`apps/mobile` ya consume `packages/design-tokens/src/index.ts` vía `apps/mobile/theme/vertice.ts` sin duplicar valores de marca — mantenerlo así. `apps/web/app/globals.css` hoy duplica los hex a mano en vez de llamar a `cssVariables()` de `web.ts`; al tocar ese archivo, migrar a la función en lugar de perpetuar la duplicación.

Mantener el lenguaje visual institucional existente salvo solicitud explícita de rediseño.

---

## BACKEND — `apps/api`

### Stack

- Node.js 20+
- Fastify 5.11.2
- Prisma 5
- PostgreSQL/PostGIS
- Redis / ioredis
- Neo4j driver
- Zod
- JWT
- bcrypt
- Sentry
- Jest

### Readiness

`/health/ready` debe mantener esta semántica:

- PostgreSQL: requerido;
- Redis: requerido;
- Neo4j: opcional/degradable.

No hacer que una caída de Neo4j impida todo el arranque de la API salvo cambio arquitectónico explícito.

### Producción Railway

El Dockerfile es la fuente de verdad del entrypoint productivo.

Invariante de arranque:

1. migraciones Prisma;
2. drop de privilegios;
3. proceso Node;
4. readiness.

No volver a añadir un `railway.json deploy.startCommand` que diverja del Docker CMD sin una razón explícita y tests del contrato de runtime.

---

## WORKFLOWS CÍVICOS

Existe un dominio `civic_cases` / `/workflows` que conecta:

```text
Reporte territorial
  → análisis IA
  → propuesta
  → deliberación/votación/decisión
  → control público / legal
```

Reglas:

- preservar ownership del ciudadano;
- preservar source report;
- preservar AI result/audit IDs;
- evitar duplicar propuesta/control por expediente;
- derivar estados desde módulos canónicos downstream;
- no duplicar reputation events si el módulo original ya los genera.

---

## CTG ONE FEDERATION

Entrada de usuario: `Continuar con CTG One`.

Flujo existente:

```text
/auth/ctgone/start
→ CTG One
→ /auth/ctgone/callback
→ /auth/ctgone/exchange
→ sesión propia VÉRTICE
```

Invariantes:

- no compartir auth cookies con `Domain=.ctgone.com`;
- no enviar tokens por query strings/fragments;
- no leer storage de la otra app;
- no vincular cuentas por mera coincidencia de email;
- no exponer federation secrets al frontend;
- CTG One federation **no** equivale a civic identity assurance.

Ver `docs/integrations/CTG_ONE.md`.

---

## AUTORIDAD Y ROLES

Modelo activo:

```text
persistent grants:
  citizen | moderator | admin | superadmin

session:
  active_role
  sid

JWT:
  ligado a sesión
```

Reglas críticas:

- un usuario solo puede activar un rol que posea;
- privilegios elevados se revalidan contra autoridad persistente;
- una revocación debe invalidar privilegio efectivo sin depender de esperar expiración larga de un JWT;
- el primer root superadmin se bootstrappea con autoridad federada server-managed de CTG One;
- después del bootstrap, nuevos superadmins se conceden desde VÉRTICE;
- nunca usar email como clave de autoridad raíz;
- no codificar/exponer públicamente el root UUID;
- impedir eliminar el último superadmin;
- auditar bootstrap, grants y cambios de rol.

El dashboard `/dashboard/authority` es parte del producto actual.

---

## CIVIC IDENTITY ASSURANCE

Nunca confundir:

```text
authentication
≠ contact verification
≠ civic identity assurance
```

`CIVIC_IDENTITY_ASSURANCE_PROVIDERS` es allowlist explícita y fail-closed.

`ctg_one` no es assurance por defecto.

### Votación

Al abrir una propuesta en `voting`, se construye un `proposal_voter_roll` usando la política de assurance vigente y el alcance territorial.

Durante la ventana electoral:

- el padrón congelado es la autoridad de admisión;
- no reevaluar providers ad hoc por cada request;
- si no existe padrón, fallar cerrado.

Ver `docs/security/CIVIC_IDENTITY_ASSURANCE.md`.

---

## GOBERNANZA Y LEDGER DE DEMOCRACIA LÍQUIDA

No duplicar la lógica electoral entre ruta y servicio.

### Delegaciones

Scopes:

- `general`
- `domain`
- `proposal`

Precedencia:

```text
proposal > domain > general
```

Respetar `valid_from`, `valid_until` y pertenencia al padrón congelado.

### Ledger

Invariantes:

- 1 ciudadano elegible = máximo 1 participación efectiva por propuesta;
- no doble influencia directa + delegada;
- nullifiers opacos;
- participación delegada durable;
- voto directo puede sustituir participación delegada previa sin crear una segunda voz;
- `total_votes` y tallies deben reflejar registros durables;
- el quórum debe ser coherente con el mismo universo electoral.

Toda modificación de `castVote`, ledger, delegaciones o voter roll requiere tests de regresión de concurrencia/fail-closed.

Ver `docs/governance/GOVERNANCE.md`.

---

## AI SERVICE — `apps/ai`

### Stack

- Python 3.12
- FastAPI
- LangGraph
- Anthropic
- Pinecone
- Voyage AI

### Agentes actuales

1. CitizenAgent
2. GovernanceAgent
3. PolicyAgent
4. TerritorialAgent
5. IntegrityAgent
6. CommsAgent
7. LegalAgent

`BaseAgent.MODEL` actual: `claude-sonnet-4-6`.

No volver a documentar `claude-sonnet-4-20250514` como modelo actual salvo rollback explícito en código.

### RAG

- embeddings: Voyage AI `voyage-3`;
- vector store: Pinecone;
- fallback hash: solo resiliencia técnica, **no** equivalente semántico al RAG real.

---

## DATOS

### PostgreSQL/PostGIS

Autoridad primaria para estado transaccional y geoespacial.

### Redis

- cache;
- sesiones/estado efímero;
- rate limiting;
- pub/sub.

### Neo4j

Reputación/grafo; no autoridad de identidad o votos.

### MongoDB

No tratar como dependencia activa hasta que exista integración real en código/configuración.

---

## BLOCKCHAIN

`contracts/` usa:

- Solidity ^0.8.24
- Hardhat
- OpenZeppelin 5
- Polygon

Scripts disponibles para local, Amoy y mainnet.

No afirmar “deployed on-chain” sin evidencia del entorno.

Nunca almacenar on-chain:

- PII;
- cédula;
- email;
- voto individual;
- secretos.

---

## SEGURIDAD

Reglas no negociables salvo decisión arquitectónica explícita:

- no inferir civic identity assurance desde login, email, wallet o reputación;
- no confiar solo en claims JWT antiguos para roles privilegiados;
- no duplicar admisión electoral fuera del contrato canónico;
- no exponer secretos de Anthropic, CTG One, blockchain o providers al frontend;
- mantener separación entre identidad pública y sentido del voto;
- aplicar fail-closed cuando falta voter roll en una propuesta abierta;
- mantener rate limiting y headers de seguridad;
- preservar audit trail para autoridad y acciones sensibles.

---

## CONVENCIONES DE CÓDIGO

### TypeScript

- strict mode;
- evitar `any`;
- Zod para validación runtime;
- no introducir Express;
- no introducir Redux si Zustand resuelve el caso actual.

### Git

Conventional Commits:

```text
feat(scope): ...
fix(scope): ...
docs(scope): ...
test(scope): ...
refactor(scope): ...
chore(scope): ...
```

Preferir PRs pequeños y coherentes; no mezclar refactors no relacionados con un hotfix de producción.

---

## DOCUMENTACIÓN OBLIGATORIA

Cuando cambie un contrato importante, actualizar:

1. `README.md` si afecta la superficie del producto;
2. `docs/CURRENT_STATE.md` si cambia estado funcional;
3. documento de dominio correspondiente;
4. este `CLAUDE.md` si cambia una regla que futuros agentes deben obedecer.

Los estados deben marcarse explícitamente como:

- `✅ Implementado`
- `🟡 Integrado / pendiente de certificación`
- `🧭 Planeado`
- `⛔ No activo / retirado`

No describir como producción una integración únicamente porque el código compila o existe IaC.

---

## LECTURA RECOMENDADA ANTES DE CAMBIOS SENSIBLES

- `docs/CURRENT_STATE.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/governance/GOVERNANCE.md`
- `docs/security/CIVIC_IDENTITY_ASSURANCE.md`
- `docs/integrations/CTG_ONE.md`
- `docs/deployment/railway-vercel.md`

Para cambios en auth, governance, authority o producción, leer también los tests del módulo antes de modificar el contrato.

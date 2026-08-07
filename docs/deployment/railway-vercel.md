# Despliegue del piloto: Railway + Vercel

Guía operativa para poner el piloto de 150 usuarios en un entorno real. Cubre
solo lo que hace falta para eso — no staging separado de producción todavía,
no Kubernetes, no multi-región. Ver `CLAUDE.md` para las decisiones
arquitectónicas de fondo y el checklist completo del piloto para todo lo que
queda fuera de este documento (moderación, límites de IA, blockchain).

## Arquitectura

```
┌─────────────┐      ┌──────────────────────────┐      ┌─────────────────┐
│   Vercel    │─────▶│         Railway            │      │   Railway        │
│ apps/web    │      │ ┌───────────┐ ┌──────────┐ │      │   (opcional)     │
│ (Next.js)   │      │ │ apps/api  │ │ apps/ai  │ │      │  Neo4j           │
└─────────────┘      │ │ (Fastify  │ │ (FastAPI)│ │      │  (reputación —   │
                      │ │ +worker)  │ └──────────┘ │      │  degrada sin él) │
                      │ └─────┬─────┘      │       │      └─────────────────┘
                      │       │            │       │
                      │  ┌────▼────┐  ┌────▼────┐  │
                      │  │Postgres │  │  Redis  │  │
                      │  │+PostGIS │  │         │  │
                      │  └─────────┘  └─────────┘  │
                      └──────────────────────────┘
```

Cuatro servicios en Railway (Postgres, Redis, api, ai) + un proyecto en
Vercel (web). El worker de jobs (mint de badges, registro on-chain) corre
**dentro** del proceso de `apps/api` — no es un servicio aparte, no hay nada
extra que desplegar para eso.

Neo4j se deja fuera del piloto: la reputación funciona sin él (los eventos
simplemente no alimentan el grafo), y no vale el costo/complejidad extra
todavía. El healthcheck `/health/ready` lo trata explícitamente como
dependencia **opcional**: reporta su estado (`"neo4j": "fail"` y
`status: "degraded"`) pero devuelve **200**, así que el servicio arranca
normalmente sin él. Solo Postgres y Redis lo pueden dejar en 503
(`status: "unavailable"`).

## 0. Antes de empezar — bugs de Dockerfile ya corregidos aquí

Al preparar esto se encontraron y verificaron (con una simulación completa de
cada stage, sin Docker daemon disponible en este entorno, pero replicando
exactamente lo que cada `RUN`/`COPY` hace) **tres problemas reales que
habrían roto cualquier intento de desplegar `apps/api` tal como estaba**:

1. `pnpm install` en el stage `deps` fallaba siempre — el `postinstall` de
   `@vertice/api` corre `prisma generate`, que necesita `prisma/schema.prisma`,
   y ese stage solo copiaba `package.json`. Corregido copiando
   `apps/api/prisma` también en ese stage.
2. `@vertice/api` no compilaba de forma confiable porque `@vertice/types`
   (referencia de proyecto TypeScript) no se construía antes — corregido con
   un `pnpm --filter @vertice/types build` explícito antes del build de la API.
3. La imagen de producción (`runner` stage) copiaba solo el `node_modules`
   de la raíz, pero en un monorepo pnpm las dependencias reales de
   `apps/api` (fastify, `@prisma/client` generado, `@vertice/types`, bcrypt,
   etc.) viven en `apps/api/node_modules` con symlinks relativos hacia la
   raíz y hacia `packages/types` — al aplanar la imagen esos symlinks
   quedaban rotos y el contenedor habría muerto en el primer `require()`.
   Corregido preservando la estructura real del monorepo en la imagen final.

Verificado de punta a punta: instalación limpia → build → arranque del
servidor con `node apps/api/dist/index.js` resolviendo Fastify, el cliente
Prisma generado (real, no un stub) y `@vertice/types` sin errores, hasta el
punto de intentar conectarse a Postgres/Redis reales (que no existen en el
entorno de prueba — ese es el único fallo esperado, y confirma que todo lo
anterior funciona).

## 1. PostgreSQL + PostGIS en Railway

**No uses el plugin "PostgreSQL" por defecto de Railway** — es un
`postgres` vanilla sin PostGIS, y el schema de VÉRTICE OS depende de tipos
`geography(Point,4326)` en `territorial_reports`.

Esto está verificado, no supuesto: contra un Postgres 16 sin PostGIS la
**primera** migración falla en seco con
`ERROR: extension "postgis" is not available` (código `0A000`) y
`prisma migrate deploy` aborta sin aplicar nada. Con PostGIS instalado, las
5 migraciones aplican limpias.

Usa en su lugar la plantilla de extensiones de Railway (PostgreSQL 18,
PostGIS incluido junto con pgvector/pg_cron entre otras, se activan por
variable de entorno sin compilar nada):
<https://railway.com/deploy/postgresql-extensions>

Alternativa más simple si prefieres una imagen fija: la plantilla dedicada de
PostGIS (`postgis/postgis:17-3.5`, el mismo motor que usa
`docker-compose.yml` en local):
<https://railway.com/deploy/postgis--postgis>

Cualquiera de las dos te da un `DATABASE_URL` — cópialo, lo necesitas para
el servicio `api`.

## 2. Redis en Railway

Plugin "Redis" estándar de Railway, sin configuración especial. Copia el
`REDIS_URL` que genera.

## 3. Servicio `api` (Fastify + worker de jobs)

1. **New Service → Deploy from GitHub repo**, selecciona este repo.
2. **Root Directory:** `.` (raíz del repo) — el `Dockerfile` de `apps/api`
   necesita el contexto completo del monorepo para resolver el workspace
   pnpm (`packages/types`, lockfile compartido). El `railway.json` en la
   raíz de este repo ya le dice a Railway dónde está el Dockerfile
   (`apps/api/Dockerfile`) y el healthcheck (`/health/ready`) — no hace
   falta configurar nada más ahí.
3. **Variables de entorno** — genera cada secreto con `openssl rand -hex 32`,
   nunca reutilices los de `.env.example`:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | el de Postgres (paso 1) |
   | `REDIS_URL` | el de Redis (paso 2) |
   | `JWT_SECRET` | `openssl rand -hex 32` |
   | `VOTE_NULLIFIER_SECRET` | `openssl rand -hex 32` |
   | `IDENTITY_PEPPER` | `openssl rand -hex 32` |
   | `AI_SERVICE_SECRET` | `openssl rand -hex 32` — el mismo valor va también en el servicio `ai` (paso 4) |
   | `CORS_ORIGIN` | la URL de Vercel una vez la tengas (paso 5) — con `http://localhost:3000` mientras tanto |
   | `AI_SERVICE_URL` | la URL interna/pública del servicio `ai` de Railway |
   | `BCRYPT_ROUNDS` | `12` |

   Deja sin definir `POLYGON_*`, `CIVIC_SBT_ADDRESS`, `VOTING_REGISTRY_ADDRESS`
   y `DID_COMMITMENT_PEPPER` — el sistema omite el minting/registro on-chain
   limpiamente si faltan (ver checklist: blockchain queda fuera del piloto).

4. **Start Command** (Settings → Deploy → Custom Start Command) — encadena
   la migración con el arranque, igual que hace `docker-compose.yml` en
   local:
   ```
   npx prisma migrate deploy && node apps/api/dist/index.js
   ```
   `prisma migrate deploy` solo aplica migraciones pendientes — es seguro
   ejecutarlo en cada deploy, no reintroduce nada.
5. Al arrancar, confirma en los logs la línea `[jobs] worker started` — es
   el worker de la cola durable (mint de badges, registro on-chain)
   corriendo dentro de este mismo proceso.

## 4. Servicio `ai` (FastAPI — orquestador IA)

1. **New Service → Deploy from GitHub repo**, mismo repo.
2. **Root Directory:** `apps/ai` — este Dockerfile es autocontenido, no
   necesita el resto del monorepo. `apps/ai/railway.json` ya apunta al
   Dockerfile local y al healthcheck.
3. **Variables de entorno:**

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `ANTHROPIC_API_KEY` | tu clave real |
   | `AI_SERVICE_SECRET` | el mismo valor exacto que en `api` (paso 3) |
   | `REDIS_URL` | el mismo Redis del paso 2 |
   | `CORS_ORIGIN` | la URL pública del servicio `api` |
   | `PINECONE_API_KEY` / `PINECONE_INDEX` | si vas a usar el pipeline RAG; si no, déjalas vacías — el servicio arranca igual, solo `/rag/*` fallaría |

   El Dockerfile ya respeta `$PORT` (corregido en este mismo cambio — antes
   tenía el puerto 8001 fijo en el `CMD`, incompatible con cómo Railway
   asigna puertos).

## 5. Web en Vercel

1. **New Project → Import** este repo.
2. **Root Directory:** `apps/web` (no la raíz del monorepo — Vercel
   redespliega solo cuando cambia algo bajo ese directorio si lo configuras
   así, y detecta el workspace pnpm automáticamente desde ahí). No hace
   falta `vercel.json`.
3. **Variables de entorno** (Project Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | URL pública del servicio `api` en Railway |
   | `NEXT_PUBLIC_WS_URL` | igual, con `wss://` si Railway sirve TLS (por defecto sí) |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | tu token de Mapbox |
   | `NEXT_PUBLIC_POLYGON_RPC` | opcional — deja vacío si no vas a activar blockchain para el piloto |
   | `SENTRY_ORG` / `SENTRY_PROJECT` / `NEXT_PUBLIC_SENTRY_DSN` | opcionales, solo si vas a usar Sentry ya |

4. Deploy. Vercel te da la URL de producción — vuelve al servicio `api` en
   Railway y actualiza `CORS_ORIGIN` con esa URL exacta (sin `/` al final).

## 6. Checklist de humo post-despliegue

Con los tres servicios arriba:

- [ ] `GET https://<api>/health` → `200`
- [ ] `GET https://<api>/health/ready` → `200` (confirma que Postgres/Redis responden; sin Neo4j desplegado devuelve 200 con `status: "degraded"`, que es lo esperado en el piloto)
- [ ] `GET https://<ai>/health` → `200`
- [ ] Logs de `api` muestran `[jobs] worker started` y `[redis] connected`
- [ ] Crear un ciudadano de prueba vía `POST /auth/register` desde la web desplegada
- [ ] Crear una propuesta y avalarla — confirma que la transacción atómica de avales (PR #4) funciona contra Postgres real, no solo mocks de test
- [ ] CORS: la web en Vercel puede llamar a la API sin error de origen bloqueado

## Fuera de alcance de este documento

- Multisig / deploy de contratos — ver checklist general, no bloqueante para el piloto.
- Backups automáticos + prueba de restauración — Railway hace snapshots de Postgres, pero **nadie ha probado restaurar uno todavía**; sigue pendiente como ítem propio del checklist.
- Límites de costo de IA, moderación, código de invitación — decisiones de producto, no de infraestructura.

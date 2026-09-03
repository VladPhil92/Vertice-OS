# VÉRTICE OS — Current State

> Snapshot técnico-funcional: **2 de septiembre de 2026**  
> Basado en `main` después de los PR #30–#37.

Este documento existe para separar tres categorías que en versiones anteriores de la documentación aparecían mezcladas:

1. **Implementado:** existe en el código actual y forma parte del contrato activo del producto.
2. **Integrado / pendiente de certificación:** existe código o integración, pero depende de proveedor, credenciales, infraestructura o validación productiva externa.
3. **Planeado / arquitectónico:** idea o dirección futura; no debe asumirse como dependencia actual.

---

## 1. Producto implementado

### 1.1 Dashboard ciudadano

El dashboard autenticado es el centro de comando del ciudadano y expone:

- perfil e identidad;
- reportes territoriales;
- propuestas y gobernanza;
- votos pendientes/elegibles;
- control público y módulo legal;
- reputación;
- IA cívica;
- expedientes cívicos (`/dashboard/workflows`);
- notificaciones y eventos en tiempo real;
- selector de rol por sesión;
- panel de autoridad para superadmin.

La API `GET /dashboard/me` separa actividad personal de indicadores generales de ciudad.

### 1.2 Workflows cívicos

`civic_cases` preserva un caso ciudadano de extremo a extremo:

`Reporte → IA → Propuesta → Debate → Votación → Decisión → Control`

El expediente conserva procedencia, ownership, referencias de IA/auditoría, propuesta vinculada y documento legal/control público vinculado. Los estados visibles derivan de las máquinas de estado canónicas de los módulos downstream.

### 1.3 Federación CTG One

El login ofrece `Continuar con CTG One` y reutiliza el flujo federado PKCE existente. VÉRTICE crea su propia sesión y no comparte cookies de dominio ni credenciales con CTG One.

La federación:

- autentica;
- puede vincular una identidad externa explícita;
- **no** equivale automáticamente a civic identity assurance;
- **no** debe enlazar cuentas locales por mera coincidencia de email.

### 1.4 Autoridad y roles

Modelo activo:

- grants persistentes: `citizen`, `moderator`, `admin`, `superadmin`;
- `active_role` por sesión;
- JWT ligado a `session id`;
- roles privilegiados revalidados contra la autoridad persistida;
- bootstrap del superadmin raíz mediante autoridad federada server-managed de CTG One;
- nuevos superadmins concedidos desde VÉRTICE después del bootstrap;
- protección contra eliminación del último superadmin;
- auditoría append-only de bootstrap, grants y cambios de rol.

### 1.5 Civic identity assurance P0

VÉRTICE distingue:

- autenticación;
- verificación de canal/contacto;
- prueba fuerte de identidad cívica.

`CIVIC_IDENTITY_ASSURANCE_PROVIDERS` es una allowlist explícita. Vacía significa fail-closed para el padrón de votación protegido.

El provider `ctg_one` no entra en la allowlist por defecto.

### 1.6 Gobernanza

La gobernanza implementada usa un padrón electoral congelado por propuesta. La selección del padrón se realiza al abrir la votación y se convierte en la autoridad de admisión durante la ventana electoral.

El ledger canónico de democracia líquida coordina:

- voto directo;
- participación delegada;
- nullifiers opacos;
- prevención de doble influencia;
- scopes de delegación `general`, `domain` y `proposal`;
- precedencia determinística de scopes;
- ventanas de validez;
- override directo cuando el ciudadano había participado previamente por delegación;
- tally reconstruido desde registros durables.

### 1.7 API y datos

API activa: **REST / Fastify 5**.

Módulos actuales bajo `apps/api/src/modules`:

- `auth`
- `dashboard`
- `identity`
- `territorial`
- `governance`
- `reputation`
- `legal`
- `ai`
- `workflows`
- `notifications`
- `events`

Dependencias de datos:

- PostgreSQL + PostGIS: canónico para estado relacional/territorial;
- Redis: sesiones, cache, rate limiting y pub/sub;
- Neo4j: grafo de reputación; degradable en readiness.

### 1.8 IA

`apps/ai` implementa siete agentes:

1. CitizenAgent
2. GovernanceAgent
3. PolicyAgent
4. TerritorialAgent
5. IntegrityAgent
6. CommsAgent
7. LegalAgent

El orquestador actual usa `claude-sonnet-4-6`.

RAG:

- Pinecone como vector store;
- Voyage AI `voyage-3` para embeddings;
- fallback determinístico para que ausencia de proveedores externos no tumbe el proceso, sin pretender calidad semántica equivalente.

### 1.9 Tiempo real y observabilidad

- SSE para eventos al cliente;
- Redis pub/sub;
- notificaciones internas;
- Sentry;
- `/health` y `/health/ready`;
- PostgreSQL y Redis son requeridos para readiness;
- Neo4j puede reportar degradación sin marcar toda la API como indisponible.

---

## 2. Producción e infraestructura

### Web

- Next.js 15.5.23
- Vercel

### API

- Fastify 5.11.2
- Railway
- Dockerfile como fuente de verdad del entrypoint productivo
- migraciones Prisma antes del arranque de Node
- proceso de aplicación ejecutado sin privilegios después de la migración

### AI

- FastAPI
- Railway

### Estado de certificación

El repositorio contiene controles y convergencia de runtime, pero cada release debe distinguir entre:

- build/test verde;
- deployment iniciado;
- readiness confirmado;
- dependencias externas certificadas.

No documentar `deployed` únicamente porque exista código o configuración IaC.

---

## 3. Blockchain

El repositorio contiene contratos Solidity/Hardhat para Polygon, incluidos `CivicSBT` y `VotingRegistry`, junto con scripts de despliegue para local, Amoy y Polygon.

Clasificación actual: **código implementado; despliegue on-chain dependiente del entorno**.

No almacenar PII on-chain. Los datos personales y el sentido individual del voto deben permanecer fuera de cadena.

---

## 4. Componentes que NO son contrato operativo actual

Los siguientes elementos aparecieron en documentos tempranos o diseños de referencia, pero no deben describirse como runtime obligatorio sin código nuevo que los active:

- API Gateway GraphQL/Apollo Federation;
- Governance Engine separado escrito en Go;
- MongoDB como base documental obligatoria;
- Kafka como event bus obligatorio;
- The Graph como indexador productivo obligatorio;
- integración productiva certificada con Registraduría;
- liveness/biometría productiva certificada;
- DAO de gobierno de plataforma;
- ZKP productivo para cada voto;
- wallet de Verifiable Credentials como requisito activo de onboarding.

---

## 5. Convenciones para documentación futura

Toda documentación de estado debe usar una de estas etiquetas:

- `✅ Implementado`
- `🟡 Integrado / pendiente de certificación`
- `🧭 Planeado`
- `⛔ No activo / retirado`

No usar expresiones como “implementado” o “producción” para describir únicamente intención arquitectónica.

Cuando un PR cambie alguno de estos contratos, actualizar como mínimo:

1. `README.md` si afecta la superficie del producto;
2. `docs/CURRENT_STATE.md` si cambia el estado funcional;
3. el documento de dominio correspondiente;
4. `CLAUDE.md` si cambia una regla que futuros agentes deben respetar.

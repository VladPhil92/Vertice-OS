# VÉRTICE OS — Current State

> Snapshot técnico-funcional: **4 de septiembre de 2026**  
> Basado en `main` P0.7 + integración vendor-specific Veriff P0.8 en proceso de certificación.

Este documento separa tres categorías:

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

### 1.5 Civic identity assurance P0.8

VÉRTICE distingue:

- autenticación;
- verificación de canal/contacto;
- prueba fuerte de identidad cívica.

`CIVIC_IDENTITY_ASSURANCE_PROVIDERS` es una allowlist explícita. Vacía significa fail-closed para el padrón de votación protegido. `ctg_one` no entra en la allowlist por defecto.

La frontera técnica implementada incluye:

- lifecycle durable `pending → review → verified / rejected / expired / revoked`;
- ingress normalizado HMAC aislado por provider y key-id para adapters internos;
- registry compile-time;
- contrato de adapter nativo sobre bytes crudos;
- replay distribuido y atómico respaldado por Redis;
- harness adversarial P0.5;
- canary de lifecycle P0.6;
- ingress nativo P0.7 en `POST /identity/providers/:provider/webhook`;
- procedencia auditable entre hop HMAC interno y webhook nativo;
- readiness administrativo en `GET /identity/providers/readiness`;
- **adapter vendor-specific `veriff` P0.8**;
- verificación Veriff `x-auth-client` + HMAC-SHA256 sobre raw body;
- normalización de decision webhook y user-defined status;
- runtime readiness independiente de compile-time registration y policy allowlist;
- bootstrap ciudadano de sesión Veriff en `POST /identity/providers/veriff/session`;
- verificación criptográfica de request/response al crear sesión;
- `GET /identity/providers/availability` para exponer disponibilidad sin secretos.

### Estado Veriff

`🟡 Integrado / pendiente de certificación externa`.

El código Veriff está preparado para Colombia, pero la autoridad sigue fail-closed mientras no existan las credenciales reales de una integración Veriff y no se ejecute el canary. Las credenciales pueden configurarse sin añadir `veriff` a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`, permitiendo sandbox sin habilitar gobernanza.

VÉRTICE no persiste payloads documentales/biométricos de Veriff. El flujo ciudadano alojado recibe únicamente un UUID opaco como `vendorData/endUserId`; el webhook se reduce a estado normalizado, referencias no-PII, timestamps y hash de evidencia mínima.

Runbook: `docs/integrations/VERIFF.md`.

### 1.6 Gobernanza

La gobernanza implementada usa un padrón electoral congelado por propuesta. La selección del padrón se realiza al abrir la votación y se convierte en la autoridad de admisión durante la ventana electoral.

El ledger canónico de democracia líquida coordina:

- voto directo;
- participación delegada;
- nullifiers opacos;
- prevención de doble influencia;
- scopes `general`, `domain` y `proposal`;
- precedencia determinística;
- ventanas de validez;
- override directo;
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

- PostgreSQL + PostGIS: estado canónico relacional/territorial;
- Redis: sesiones, cache, rate limiting, pub/sub y replay distribuido de identity proofing;
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

- SSE;
- Redis pub/sub;
- notificaciones internas;
- Sentry;
- `/health` y `/health/ready`;
- PostgreSQL y Redis requeridos para readiness;
- Neo4j degradable;
- readiness de identity providers separa `registered`, `runtime_ready` y `activated`.

---

## 2. Producción e infraestructura

### Web

- Next.js 15.5.23
- Vercel

### API

- Fastify 5.11.2
- Railway
- Dockerfile como fuente de verdad
- migraciones Prisma antes del arranque de Node
- proceso ejecutado sin privilegios después de migración

### AI

- FastAPI
- Railway

### Estado de certificación

Cada release debe distinguir:

- build/test verde;
- deployment iniciado;
- readiness confirmado;
- dependencias externas certificadas.

No documentar `deployed` únicamente porque exista código o configuración IaC.

Para Veriff P0.8, **integrado** significa que el adapter, sesión, firma, replay y lifecycle existen en código. **Activo para gobernanza** exige además credenciales reales, webhooks configurados, canary satisfactorio y allowlist explícita.

---

## 3. Blockchain

El repositorio contiene contratos Solidity/Hardhat para Polygon, incluidos `CivicSBT` y `VotingRegistry`, junto con scripts para local, Amoy y Polygon.

Clasificación actual: **código implementado; despliegue on-chain dependiente del entorno**.

No almacenar PII on-chain. Los datos personales y el sentido individual del voto deben permanecer fuera de cadena.

---

## 4. Componentes que NO son contrato operativo actual

- API Gateway GraphQL/Apollo Federation;
- Governance Engine separado en Go;
- MongoDB obligatorio;
- Kafka obligatorio;
- The Graph obligatorio;
- integración productiva certificada con Registraduría;
- DAO de gobierno de plataforma;
- ZKP productivo para cada voto;
- wallet de Verifiable Credentials como requisito activo.

La liveness/biometría deja de describirse como mera intención arquitectónica en P0.8 porque Veriff está integrado como provider de IDV, pero **su uso productivo real continúa pendiente de la integración contratada/certificada**.

---

## 5. Convenciones para documentación futura

- `✅ Implementado`
- `🟡 Integrado / pendiente de certificación`
- `🧭 Planeado`
- `⛔ No activo / retirado`

No usar “implementado” o “producción” para describir únicamente intención arquitectónica.

Cuando un PR cambie estos contratos, actualizar como mínimo:

1. `README.md` si afecta superficie del producto;
2. `docs/CURRENT_STATE.md`;
3. documento de dominio/integración;
4. `CLAUDE.md` si cambia una regla para futuros agentes.

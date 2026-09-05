# VÉRTICE OS — Current State

> Snapshot técnico-funcional: **4 de septiembre de 2026**  
> Basado en `main` P0.9 + evidence-backed external certification P1.0 en validación.

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

### 1.5 Civic identity assurance P1.0

VÉRTICE distingue:

- autenticación;
- verificación de canal/contacto;
- prueba fuerte de identidad cívica;
- certificación operativa de provider;
- evidencia durable del canary externo.

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
- adapter vendor-specific `veriff` P0.8;
- verificación Veriff `x-auth-client` + HMAC-SHA256 sobre raw body;
- normalización de decision webhook y user-defined status;
- runtime readiness independiente de compile-time registration y policy allowlist;
- bootstrap ciudadano de sesión Veriff en `POST /identity/providers/veriff/session`;
- `GET /identity/providers/availability` para exponer disponibilidad sin secretos;
- certification interlock P0.9 mediante `CIVIC_IDENTITY_CERTIFIED_PROVIDERS`;
- **ledger durable P1.0 `civic_identity_provider_certifications`**;
- certificación P1.0 construida solo desde receipts persistidos con `ingress_signature_version=2`;
- validación `verified → revoked → expired`, subject binding, assurance y monotonicidad;
- `evidence_digest` y `subject_binding_hash` SHA-256 sin persistir raw payloads;
- controles superadmin para certificar/listar/revocar en `/identity/provider-certifications`;
- auditoría administrativa de certificación y revocación;
- `governance_eligible` para providers nativos exige certificación durable activa además de P0.9;
- readiness administrativo separado para `registered`, `runtime_ready`, `promoted`, `evidence_certified`, `activated` y `governance_ready`.

### Estado Veriff

`🟡 Integrado / pendiente de certificación externa real`.

El código Veriff está preparado para Colombia, pero la autoridad sigue fail-closed mientras no existan las credenciales reales de una integración Veriff y no se ejecute el canary.

P1.0 añade una garantía adicional: incluso si `veriff` aparece por error en las variables de promoción y governance allowlist, un proof nativo no puede producir `governance_eligible=true` sin una certificación durable construida desde eventos nativos autenticados ya persistidos.

Las credenciales pueden configurarse sin añadir `veriff` a las allowlists, permitiendo sandbox y recepción de webhooks sin habilitar gobernanza.

VÉRTICE no persiste payloads documentales/biométricos de Veriff. La certificación conserva solamente commitments criptográficos, event IDs, timestamps y metadata operativa mínima.

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

- PostgreSQL + PostGIS: estado canónico relacional/territorial y evidencia durable de certificación de providers;
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
- readiness de identity providers separa estado de adapter, credenciales, promoción, evidencia y autoridad final.

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

Para Veriff, **integrado** significa que el adapter, sesión, firma, replay, lifecycle, interlock P0.9 y ledger P1.0 existen en código. **Activo para gobernanza** exige además credenciales reales, webhooks configurados, canary satisfactorio, registro durable P1.0 activo, promoción en `CIVIC_IDENTITY_CERTIFIED_PROVIDERS` y allowlist explícita en `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`.

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

La liveness/biometría deja de describirse como mera intención arquitectónica desde P0.8 porque Veriff está integrado como provider de IDV, pero **su uso productivo real continúa pendiente de integración contratada, credenciales reales y evidencia externa certificada P1.0**.

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

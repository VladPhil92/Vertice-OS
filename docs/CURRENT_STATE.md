# VÉRTICE OS — Current State

> Snapshot técnico-funcional: **7 de septiembre de 2026**  
> Baseline de modernización: Node.js 22.13+, pnpm 10, Next.js 15.5.24 y cliente nativo Expo SDK 57.

Este documento clasifica el estado por evidencia:

- **✅ Implementado:** existe como contrato ejecutable en el repositorio.
- **🟡 Integrado / pendiente de certificación:** existe código, pero la capacidad completa depende de credenciales, infraestructura, stores o evidencia externa.
- **🧭 Planeado:** dirección de producto todavía no completa.
- **⛔ No activo:** arquitectura histórica o componente retirado que no debe describirse como runtime actual.

---

## 1. Plataforma activa

### 1.1 Web y dashboard

`apps/web` es la experiencia web/PWA sobre Next.js 15.5.24 y React 18. El dashboard autenticado funciona como centro de mando ciudadano e integra:

- identidad/perfil cívico;
- red social de gestión comunitaria;
- acciones cívicas y evidencias;
- reportes territoriales;
- propuestas, gobernanza y votaciones consultivas;
- control público / legal;
- reputación;
- IA cívica;
- workflows/expedientes;
- notificaciones y tiempo real;
- rol activo y superficies de autoridad.

`GET /dashboard/me` es el agregado principal para la actividad y atención del ciudadano. La web productiva conserva el contrato same-origin hacia `/api` para evitar enviar credenciales directamente a un origen Railway desde el navegador.

La PWA dispone de manifest, service worker, offline fallback y web push. Peticiones `/api/*`, `/auth/*` y artefactos versionados de Next.js no se cachean en el service worker.

### 1.2 App móvil nativa

`apps/mobile` existe desde esta actualización como workspace nativo independiente:

- Expo SDK 57;
- React Native 0.86.3;
- React 19.2.3;
- Expo Router;
- SecureStore;
- EAS build profiles.

Primera fase funcional implementada:

- login nativo;
- bootstrap de sesión;
- refresh automático del access token;
- command center ciudadano desde `/dashboard/me`;
- reputación y atención pendiente;
- métricas de acciones, reportes, propuestas, legal y workflows;
- perfil;
- pull-to-refresh;
- logout con revocación server-side.

Clasificación: **🟡 primera fase funcional**. Todavía deben trasladarse a superficies nativas completas la red comunitaria, acciones/evidencias, mapa/reportes, workflows, gobernanza, notificaciones e identity assurance. La regla arquitectónica es reutilizar contratos de API existentes, no duplicar reglas cívicas dentro del cliente.

### 1.3 Autenticación y autoridad

La autenticación mantiene dos transportes con una sola fuente de verdad de sesión:

**Web**
- `POST /auth/token`;
- refresh token en cookie httpOnly;
- access token de vida corta;
- refresh vía `/auth/refresh`.

**Native**
- `POST /auth/mobile/token`;
- `POST /auth/mobile/refresh`;
- `POST /auth/mobile/logout`;
- refresh token persistido únicamente en Keychain/Keystore mediante SecureStore.

Ambos transportes reutilizan `loginCitizen`, `refreshAccessToken`, `revokeSession` y las sesiones persistentes de la API. No existe un segundo sistema de identidad móvil.

El modelo de autoridad activo usa grants persistentes `citizen`, `moderator`, `admin`, `superadmin`, `active_role` por sesión y JWT ligado a `sid`. Los privilegios se revalidan contra autoridad viva y una sesión privilegiada no debe surgir desde `citizens.role` legacy.

### 1.4 Federación CTG One

`Continuar con CTG One` usa intercambio federado con PKCE. VÉRTICE crea su propia sesión y no vincula cuentas únicamente por coincidencia de email.

CTG One federation autentica, pero **no constituye por sí sola civic identity assurance**.

### 1.5 Civic identity assurance

La frontera de identidad fuerte permanece fail-closed y separa:

- autenticación;
- contacto verificado;
- prueba de identidad cívica;
- certificación operativa del provider;
- evidencia durable de canary externo.

El provider Veriff dispone de adapter, sesión, webhook nativo firmado, replay protection, lifecycle, certificación durable y controles administrativos en código. Clasificación productiva: **🟡 integrado / pendiente de credenciales y certificación externa real**.

Un provider no puede habilitar elegibilidad de gobernanza únicamente por aparecer en configuración. Se requiere la cadena de promoción/certificación prevista por el sistema.

### 1.6 Gestión comunitaria y reputación

La plataforma soporta perfil público, acciones cívicas, evidencia, resultados y reputación. El producto prioriza gestión social-comunitaria y trazabilidad sobre mecánicas de engagement manipulativas.

Reputación e identidad se mantienen separadas: una reputación alta no convierte una identidad en verificada.

### 1.7 Gobernanza

La gobernanza usa padrón congelado por propuesta y ledger canónico de participación. Coordina:

- voto directo;
- delegación;
- nullifiers opacos;
- prevención de doble influencia;
- precedencia determinística;
- override directo;
- tally reconstruible desde registros durables.

Las votaciones de la plataforma son cívicas/consultivas salvo reconocimiento jurídico o institucional externo específico.

### 1.8 API y datos

API activa: **REST / Fastify 5**.

Módulos activos incluyen:

- `auth`
- `dashboard`
- `identity`
- `territorial`
- `governance`
- `community`
- `civic-actions`
- `reputation`
- `legal`
- `ai`
- `workflows`
- `notifications`
- `events`

Datos:

- PostgreSQL + PostGIS: estado canónico relacional/territorial;
- Redis: cache, rate limiting, pub/sub y soporte operacional;
- Neo4j: grafo de reputación, degradable en readiness.

### 1.9 IA

`apps/ai` implementa agentes cívicos sobre FastAPI/LangGraph y una capa RAG con proveedores externos. La ausencia de proveedores opcionales no debe simular calidad semántica equivalente, pero puede degradarse de forma controlada según el contrato de cada feature.

### 1.10 Blockchain

`contracts/` contiene Solidity/Hardhat para Polygon, incluidos `CivicSBT` y `VotingRegistry`.

Clasificación: **🟡 código implementado; despliegue on-chain dependiente del entorno**.

PII y sentido individual del voto no deben almacenarse on-chain.

---

## 2. Actualización tecnológica de septiembre de 2026

Remediaciones ya incorporadas en la rama de actualización:

- corrección del parser regression que bloqueaba unit tests;
- Next.js `15.5.23 → 15.5.24` por seguridad;
- Node baseline `>=22.13`;
- pnpm 10 como única autoridad de lockfile del monorepo;
- eliminación de `contracts/package-lock.json`;
- app nativa Expo/React Native;
- contrato de autenticación móvil dedicado;
- SecureStore para credenciales nativas;
- hardening de Next.js (`poweredByHeader: false`, strict mode, formatos AVIF/WebP);
- `secrets.yaml` retirado del tracking/Kustomize y sustituido por `secrets.example.yaml`;
- documentación de auditoría en `TECHNOLOGY_REFRESH_2026-09-07.md`.

No se ejecuta una migración inmediata a Next.js 16 dentro de esta misma fase. El parche 15.5.24 reduce el riesgo de seguridad manteniendo el blast radius controlado; una migración de major debe tener su propia matriz de regresión y métricas Web Vitals.

---

## 3. Infraestructura y producción

### Web

- Next.js 15.5.24
- Vercel como destino operativo documentado
- producción browser API same-origin

### API

- Fastify 5
- Railway como destino operativo documentado
- Docker + migraciones Prisma + health/readiness

### AI

- FastAPI
- Railway como destino operativo documentado

### Mobile

- Expo SDK 57 / EAS build profiles
- la generación y publicación de binarios exige credenciales de Apple/Google y configuración externa del proyecto EAS

### Kubernetes

La base de Kustomize ya **no** crea un Secret desde un archivo trackeado. `vertice-secrets` debe provisionarse antes del apply mediante un secret manager, External Secrets, Vault o un proceso operacional equivalente.

---

## 4. Deuda y riesgos pendientes

### Ingeniería que puede continuar dentro del repositorio

- descomponer componentes/rutas web demasiado grandes;
- retirar árboles `legacy` una vez comprobadas referencias;
- introducir presupuestos de bundle/asset size;
- completar superficies móviles nativas de community, reports/map, workflows, governance, notifications e identity;
- ampliar tests nativos y E2E;
- evaluar Next.js 16 como migración separada;
- consolidar documentación histórica que todavía describa arquitecturas no activas.

### Acciones manuales / externas

- activar protección de `main` y required checks;
- provisionar secretos productivos;
- validar readiness después del deploy en Vercel/Railway;
- crear/configurar proyecto EAS;
- gestionar Apple Developer / Google Play Console, signing y store metadata;
- ejecutar canaries reales de proveedores de identidad;
- certificar cualquier despliegue blockchain productivo.

---

## 5. Componentes que no son contrato operativo actual

No documentar como runtime actual salvo que vuelvan a implementarse explícitamente:

- Apollo Federation/GraphQL gateway;
- Governance Engine separado en Go;
- MongoDB obligatorio;
- Kafka obligatorio;
- The Graph obligatorio;
- integración certificada por defecto con Registraduría;
- DAO de gobierno de plataforma;
- ZKP productivo para cada voto;
- wallet de Verifiable Credentials como requisito universal.

---

## 6. Regla de release

`Código presente` ≠ `release certificado`.

Un release debe distinguir al menos:

1. checks CI del commit;
2. artefacto/build generado;
3. deployment iniciado;
4. readiness confirmado;
5. canaries externos cuando la feature depende de terceros.

La documentación nunca debe declarar una capacidad productiva únicamente porque exista código o IaC.

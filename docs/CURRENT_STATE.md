# VÉRTICE OS — Current State

> Snapshot técnico-funcional: **9 de septiembre de 2026**  
> Baseline: Node.js 22.13+, pnpm 10, Next.js 15.5.24, Fastify 5 y cliente nativo Expo SDK 57 / React Native 0.86.3.

Estados de evidencia:

- **✅ IMPLEMENTED:** contrato ejecutable presente.
- **✅ INTEGRATED:** fusionado con CI exact-SHA verde.
- **🟦 DEPLOYED/READY:** runtime desplegado y verificado por evidencia aplicable.
- **🟡 External certification pending:** depende de proveedor, credenciales, dispositivo, store o aprobación externa.

## 1. Plataforma activa

### Web / Dashboard

`apps/web` es la experiencia web/PWA y el centro de mando ciudadano. Integra identidad/perfil, Red Cívica, acciones/evidencia, territorio, gobernanza, legal/control, reputación, IA, workflows, notificaciones, operaciones Pro y crowdfunding.

La web mantiene el contrato same-origin hacia `/api`; manifest/service worker/offline fallback/web push están implementados y rutas sensibles no se cachean como contenido estático.

**Estado:** ✅ IMPLEMENTED / INTEGRATED.

### API / datos

API REST sobre Fastify 5 con módulos activos de auth, dashboard, identity, territories/territorial, governance, community, civic-actions, reputation, legal, AI, workflows, notifications, events, billing y crowdfunding.

Persistencia:

- PostgreSQL + PostGIS: autoridad relacional/territorial;
- Redis: cache/rate limiting/pub-sub/operación;
- Neo4j: grafo degradable, no dependencia crítica del serving core.

**Estado:** ✅ IMPLEMENTED / INTEGRATED; runtime sujeto a release evidence por SHA.

### App móvil nativa

`apps/mobile` usa Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router y SecureStore.

Paridad de dominio implementada:

- registro/login nacional, sesión y refresh;
- command center y perfil;
- selección territorial, nodo público y activación voluntaria;
- acciones cívicas/evidencia;
- reportes, GPS foreground, mapa, cámara/galería y media confirmada;
- gobernanza, aval, voto y tally canónico;
- push-device lifecycle, inbox y deep links;
- Community/Feed, leaderboard, perfiles y follow/unfollow;
- Workflows/expedientes y detalle de caso;
- Civic Identity Assurance, proofing y handoff HTTPS a Veriff;
- crowdfunding campaign/readiness tracking;
- eliminación irreversible de cuenta desde la app.

El móvil consume contratos existentes y no calcula reputación, autoridad, settlement, payout ni elegibilidad financiera.

La configuración de release mantiene identidad canónica `com.ctgone.verticeos`, perfiles EAS separados y una frontera fail-closed: preview/production requieren API HTTPS no local, UUID real de proyecto EAS y credencial Android Maps inyectada durante build. CI utiliza únicamente placeholders para demostrar wiring/configuración; no representa signing real.

**Estado:** ✅ code/domain parity + production configuration implemented; 🟡 EAS ownership/signing, provider credentials, physical-device and store certification pending.

## 2. Plataforma territorial nacional

Phases 7A–7E sustituyen el antiguo perímetro Cartagena-only por una arquitectura nacional:

- Colombia → departamento → municipio/distrito → localidad/comuna → barrio/vereda;
- identificadores externos DANE/DIVIPOLA;
- `territory_code` durable;
- selector nacional web/mobile;
- nodos públicos `/cities` y city node;
- activation engine y cohorts operativos;
- interest ledger voluntario;
- onboarding `create account → authenticate → select municipality/district → local experience`.

Cartagena (`13001`) permanece como primer nodo `pilot_ready`, no como límite arquitectónico nacional.

Invariante: territorio seleccionado/autodeclarado ≠ residencia cívica asegurada.

## 3. Identidad y autoridad

Web y mobile comparten la misma fuente canónica de sesión. La autoridad se deriva de grants vivos y sesión activa, no de un rol legacy estático.

Civic Identity Assurance exige de forma independiente:

1. contacto verificado;
2. ingress de provider operativo;
3. prueba activa;
4. certificación externa vigente del provider nativo.

Veriff dispone de adapter, creación de sesión, webhook HMAC, replay protection, normalización, lifecycle y certificación durable.

**Estado productivo Veriff:** 🟡 integrado; credenciales/canary externo real pendientes.

CTG One federation autentica y aprovisiona identidad de ecosistema, pero no concede Civic Identity Assurance por sí sola.

## 4. Gestión comunitaria, reputación y gobernanza

Community soporta feed público/siguiendo, perfiles, social graph, leaderboard y señales de corroboración/disputa.

Reputación prioriza evidencia/resultados. Seguidores, likes, impresiones, pagos, donaciones, suscripciones y capacidad económica no suman autoridad cívica.

Gobernanza usa padrón congelado y ledger reconstructible de participación. Voto directo/delegación/override/nullifiers se resuelven server-side.

Las votaciones son cívicas/consultivas salvo reconocimiento institucional/jurídico externo específico.

## 5. Crowdfunding y monetización

El stack implementado incluye:

- Free/Pro y metering;
- lifecycle de campañas;
- categorías y políticas flexible/all-or-nothing/milestone;
- comisión canónica 1% / 2.5% / 3.5% según categoría/modelo;
- payment ledger e idempotencia;
- refunds/reconciliation;
- payout readiness;
- binding de destino BRE-B;
- Wompi payout adapter/control plane;
- Financial Operations Command Center;
- emergency stops separados para checkout, collection y payouts;
- Golden Financial Integrity.

**Estado:** ✅ integridad interna implementada/certificable por CI; 🟡 Mercado Pago/Wompi/BRE-B reales requieren credenciales, bounded canary, settlement/refund/payout y reconciliación externa antes de operación abierta.

## 6. IA y blockchain

`apps/ai`: FastAPI/LangGraph/RAG con degradación controlada cuando proveedores opcionales no están disponibles.

`contracts/`: Solidity/Hardhat/Polygon (`CivicSBT`, `VotingRegistry`). Blockchain es opcional para el core y no debe almacenar PII ni sentido individual del voto.

## 7. Release engineering

El repositorio separa:

`IMPLEMENTED → INTEGRATED → DEPLOYED → READY → CERTIFIED`

Gates especializados incluyen:

- CI general;
- Semgrep Community SAST;
- Golden E2E Journeys;
- Golden Main Governance Contract;
- Golden Financial Integrity;
- Financial Operations Command Center;
- Frontend Runtime Contract;
- Railway Runtime Contract;
- Production Hardening;
- Identity Provider Certification;
- National Platform Readiness;
- National Citizen Activation;
- National Account Onboarding;
- Mobile Core Parity;
- Mobile Device Release Contract;
- Mobile production fail-closed configuration;
- Mobile Domain Parity;
- Account Deletion Privacy;
- Cartagena Pilot Same-SHA Runtime Canary;
- Market Release Certification Evidence.

`main` está protegida por el ruleset activo `Golden Main Protection`: PR obligatorio, conversaciones resueltas, branch up-to-date, siete required GitHub Actions checks, squash/rebase únicamente, sin bypass, y bloqueo de deletion/force-push. La política fue verificada operacionalmente mediante PR #148 y GitHub reporta `main.protected = true`.

## 8. Deuda restante

### Puede continuar automáticamente en repositorio

- refinamientos UX/performance/accessibility;
- ampliar E2E y source contracts;
- bundle budgets;
- retirar legacy comprobado;
- refactor de componentes grandes;
- runbooks, checklists y documentación;
- static security/quality gates;
- store metadata/privacy-data mapping que no requiera credenciales externas.

Estos trabajos son mejoras incrementales; ya no representan ausencia de paridad de dominio base.

### Requiere intervención de operador/terceros

- crear/vincular el proyecto EAS real y provisionar sus variables por ambiente;
- Apple Developer, Google Play Console y signing;
- Google Maps production key restringida con package + signing SHA-1 real;
- APNs/FCM/EAS push credentials;
- builds firmados y smoke de dispositivos físicos Android/iOS;
- Cloudflare Images production canary;
- Veriff production credentials/canary;
- Mercado Pago bounded real-money canary, settlement y refund;
- Wompi/BRE-B production access, payout canary y conciliación;
- aprobación legal/compliance/privacidad;
- App Store / Google Play submission y revisión.

La separación completa se mantiene en `docs/engineering/MARKET_RELEASE_COMPLETION.md`; el runbook móvil está en `docs/engineering/MOBILE_PRODUCTION_RELEASE.md`.

## 9. Componentes que NO son contrato operativo requerido

No documentar como dependencia actual salvo reintroducción explícita:

- Apollo Federation/GraphQL gateway;
- Governance Engine separado en Go;
- MongoDB obligatorio;
- Kafka obligatorio;
- The Graph obligatorio;
- Registraduría certificada por defecto;
- DAO de gobierno de plataforma;
- ZKP productivo para cada voto;
- wallet VC como requisito universal.

## 10. Regla final

`Código presente` no equivale a `CERTIFIED FOR MARKET RELEASE`.

La plataforma solo alcanza certificación comercial completa cuando el SHA de release supera los gates internos aplicables y existe evidencia externa real para dispositivos, identidad, media, pagos/payouts, cumplimiento legal y stores.

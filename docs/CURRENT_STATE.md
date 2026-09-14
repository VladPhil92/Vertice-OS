# VÉRTICE OS — Current State

> Snapshot técnico-funcional: **13 de septiembre de 2026**  
> Evidence sync: **2026-09-13**  
> Baseline auditado antes de esta fase: `ad21e7ae916fc071113fe007ae27b4523bd425fd`  
> Estado de promoción: **RC PRE-FLIGHT / NOT CERTIFIED FOR MARKET RELEASE**.

Estados de evidencia:

- **✅ IMPLEMENTED:** contrato ejecutable presente.
- **✅ INTEGRATED:** fusionado con CI exact-SHA verde.
- **🟦 DEPLOYED/READY:** runtime desplegado y verificado por evidencia aplicable.
- **🟡 External certification pending:** depende de proveedor, credenciales, dispositivo, store o aprobación externa.
- **⛔ NOT CERTIFIED:** código, configuración o una validación estructural no sustituyen evidencia externa real.

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

**Estado:** ✅ IMPLEMENTED / INTEGRATED; runtime productivo sujeto a evidencia exact-SHA.

### App móvil nativa

`apps/mobile` usa Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router y SecureStore.

Paridad de dominio implementada:

- registro/login nacional, sesión, refresh y federación CTG One;
- command center y perfil;
- selección territorial, nodo público, activación voluntaria y residence assurance;
- acciones cívicas/evidencia;
- reportes, GPS foreground, mapa, cámara/galería y media confirmada;
- gobernanza, aval, voto y tally canónico;
- push-device lifecycle, inbox y deep links;
- Community/Feed, leaderboard, perfiles, follow/unfollow, block/report y moderación;
- Workflows/expedientes, detalle de caso, timeline y artefactos persistidos;
- Civic Identity Assurance, proofing y handoff HTTPS a Veriff;
- crowdfunding/readiness y campañas en modo de observación financiera segura;
- eliminación irreversible de cuenta desde la app.

Las fases de convergencia recientes dejaron las superficies móviles primarias y secundarias sobre el runtime visual canónico de VÉRTICE: design tokens compartidos, Montserrat/Inter/DM Mono, `VerticeBrand`, `VerticeIcon`/Lucide y gates antirregresión. Esto incluye Notificaciones/Identidad/Eliminación, Territorio, Ciudad/Reportes, Community/Moderación, Workflows/Expedientes y Crowdfunding/Readiness.

El móvil consume contratos existentes y no calcula por su cuenta reputación, autoridad, elegibilidad de gobernanza, settlement, payout ni elegibilidad financiera. En crowdfunding, lifecycle, activación y aceptación de contribuciones permanecen estados distintos provenientes del servidor.

La configuración de release mantiene identidad canónica `com.ctgone.verticeos`, perfiles EAS separados y una frontera fail-closed: preview/production requieren API HTTPS pública, UUID real de proyecto EAS y credencial Android Maps inyectada durante build. CI usa placeholders no secretos para probar wiring/configuración; no representa signing real.

`Security Scan` mantiene además la frontera de credenciales de firma móvil: rechaza keystores, claves `.p8`, bundles `.p12`, provisioning profiles, Firebase/service-account files y material de private key accidentalmente versionado. `.gitignore` excluye también `.apk`, `.aab` e `.ipa` generados.

**Estado:** ✅ code/domain/design parity + production configuration + repository signing hygiene implemented; 🟡 EAS ownership/signing, provider credentials, physical-device and store certification pending.

## 2. Plataforma territorial nacional

Las fases nacionales sustituyeron el antiguo perímetro Cartagena-only por una arquitectura:

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

## 3. Identidad, CTG One y autoridad

Web y Mobile comparten la fuente canónica de sesión. La autoridad se deriva de grants vivos y sesión activa, no de un rol legacy estático.

CTG One federation autentica y aprovisiona identidad de ecosistema, pero no concede Civic Identity Assurance por sí sola. La identidad federada usa subject estable; no se hace auto-merge por email y Mobile no captura la contraseña de CTG One.

Civic Identity Assurance exige independientemente contacto verificado, ingress de provider operativo, prueba activa y certificación externa vigente del provider. Veriff dispone de adapter, creación de sesión, webhook HMAC, replay protection, normalización, lifecycle y certificación durable.

**Estado productivo Veriff:** 🟡 integrado; credenciales y canary externo real pendientes.

## 4. Community, reputación y gobernanza

Community soporta feed público/siguiendo, perfiles, social graph, leaderboard, corroboración/disputa, reportes, bloqueo y controles de Trust & Safety.

Reputación prioriza evidencia/resultados. Seguidores, likes, impresiones, pagos, donaciones, suscripciones y capacidad económica no suman autoridad cívica. Seguir a una persona no equivale a respaldo político y un ranking no concede elegibilidad de gobernanza.

Gobernanza usa padrón congelado y ledger reconstructible de participación. Voto directo/delegación/override/nullifiers se resuelven server-side. Las votaciones son cívicas/consultivas salvo reconocimiento institucional/jurídico externo específico.

## 5. Workflows y expedientes

Lista y detalle de expedientes están convergidos en Mobile y Web con trazabilidad de estado, timeline y artefactos persistidos. El cliente no impone una secuencia obligatoria análisis → propuesta → control y no inventa transiciones administrativas o jurídicas.

**Autoridad:** el backend conserva la fuente de verdad sobre la etapa y las transiciones del expediente.

## 6. Crowdfunding y monetización

El stack implementado incluye:

- Free/Pro y metering;
- lifecycle de campañas;
- categorías y políticas flexible/all-or-nothing/milestone;
- comisión canónica por categoría/modelo;
- payment ledger e idempotencia;
- refunds/reconciliation;
- payout readiness;
- binding de destino BRE-B;
- Wompi payout adapter/control plane;
- Financial Operations Command Center;
- emergency stops separados para checkout, collection y payouts;
- Golden Financial Integrity;
- superficie móvil de readiness/campañas con frontera read-only y estados server-authoritative.

Un monto mostrado por API no constituye evidencia local de settlement bancario. Un estado `ready` no equivale a una transferencia o payout ejecutado. Pagos, donaciones, KYC/KYB, settlement y payouts no modifican reputación, ranking, voto ni autoridad cívica.

**Estado:** ✅ integridad interna implementada y certificable por CI; 🟡 Mercado Pago/Wompi/BRE-B reales requieren credenciales, bounded canary, settlement/refund/payout y reconciliación externa antes de operación abierta.

## 7. IA y blockchain

`apps/ai`: FastAPI/LangGraph/RAG con degradación controlada cuando proveedores opcionales no están disponibles.

`contracts/`: Solidity/Hardhat/Polygon (`CivicSBT`, `VotingRegistry`). Blockchain es opcional para el core y no debe almacenar PII ni sentido individual del voto.

## 8. Release engineering y release-candidate pre-flight

El repositorio separa estrictamente:

`IMPLEMENTED → INTEGRATED → DEPLOYED → READY → CERTIFIED`

Gates especializados incluyen CI general, Semgrep Community SAST, Golden E2E, Golden Main Governance, Golden Financial Integrity, Financial Operations Command Center, Frontend Runtime, Railway Runtime, Production Hardening, Identity Provider Certification, National Platform Readiness/Activation/Onboarding, Mobile Core Parity, Mobile Device Release, Mobile Domain Parity, Account Deletion Privacy, Cartagena Pilot Same-SHA Runtime Canary y Market Release Certification Evidence.

Esta fase añade una segunda barrera documental/mecánica: **Release Candidate State Sync**. Su función es impedir que `CURRENT_STATE.md`, la matriz de completion, el contrato de certificación, el índice de fases y el manifest de ejemplo diverjan o presenten como certificadas capacidades que todavía dependen de evidencia externa.

`main` continúa protegido por `Golden Main Protection`: PR obligatorio, conversaciones resueltas, branch up-to-date, required checks, squash/rebase únicamente, sin bypass y sin force-push/deletion.

## 9. Frontera RC

El código ya puede entrar en una disciplina de **release candidate pre-flight**, pero eso no significa que exista todavía un release comercial certificado.

La automatización puede demostrar source contracts, typechecks, tests, exports no firmados/production-like, seguridad estática, coherencia documental y determinadas propiedades de runtime cuando la infraestructura existe. No puede crear ni sustituir:

- firma real Android/iOS y ownership EAS/Apple/Google;
- pruebas en dispositivos físicos;
- credenciales y decisiones reales de Veriff/Cloudflare;
- settlement/refund de Mercado Pago ni payout/reconciliación Wompi/BRE-B;
- aprobación legal/compliance;
- aprobación de App Store o Google Play.

**Current market-release status: NOT CERTIFIED.**

## 10. Deuda restante

### Puede continuar automáticamente en repositorio

- auditorías adicionales de UX/performance/accessibility basadas en métricas reproducibles;
- ampliar E2E y source contracts;
- establecer bundle budgets solo después de capturar un baseline reproducible;
- retirar legacy demostrado como no utilizado;
- refactor de componentes grandes;
- store metadata/privacy-data mapping sin credenciales externas;
- runbooks, checklists y validadores estáticos adicionales.

No se declara un budget de performance o bundle arbitrario en esta fase: primero debe existir un baseline medido y reproducible.

### Requiere intervención de operador/terceros

- crear/vincular el proyecto EAS real y provisionar variables por ambiente;
- Apple Developer, Google Play Console y signing;
- Google Maps production key restringida con package + signing SHA-1 real;
- APNs/FCM/EAS push credentials;
- builds firmados y smoke de dispositivos físicos Android/iOS;
- Cloudflare Images production canary;
- Veriff production credentials/canary;
- Mercado Pago bounded real-money canary, settlement y refund;
- Wompi/BRE-B production access, payout canary y conciliación;
- backup/restore drill con evidencia;
- aprobación legal/compliance/privacidad;
- App Store / Google Play submission y revisión.

La separación completa se mantiene en `docs/engineering/MARKET_RELEASE_COMPLETION.md`; el contrato de evidencia está en `docs/engineering/MARKET_RELEASE_CERTIFICATION.md`.

## 11. Regla final

`Código presente` no equivale a `CERTIFIED FOR MARKET RELEASE`.

VÉRTICE solo alcanza certificación comercial completa cuando el **mismo SHA de release** supera los gates internos aplicables y existe evidencia externa real, durable y revisable para runtime, dispositivos, identidad/media, pagos/payouts, resiliencia, cumplimiento legal y stores.

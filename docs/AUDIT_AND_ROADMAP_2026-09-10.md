# VÉRTICE OS — Auditoría técnica y hoja de ruta hacia CERTIFIED FOR MARKET RELEASE

> Fecha de auditoría: **10 de septiembre de 2026**
> Snapshot base: `docs/CURRENT_STATE.md` (9 sep 2026) + `docs/engineering/MARKET_RELEASE_COMPLETION.md`
> Alcance: monorepo completo (`apps/web`, `apps/api`, `apps/ai`, `apps/mobile`, `contracts`, `packages/*`) — build, typecheck, lint, tests unitarios/integración, contratos Solidity y consistencia de invariantes de seguridad documentadas en `CLAUDE.md`.

Este documento **no reemplaza** `MARKET_RELEASE_COMPLETION.md`; lo complementa. Ese archivo ya es, en la práctica, el mapa de fases hacia certificación comercial (`A. Repository-automatable` vs `B. Operator/external`). Esta auditoría (1) valida el estado real del código con herramientas ejecutadas, (2) corrige errores concretos encontrados, y (3) reproyecta las fases restantes con hitos verificables.

---

## 1. Resumen ejecutivo

El repositorio está considerablemente más maduro de lo que sugeriría un vistazo superficial: 7 fases territoriales (7A–7G), paridad móvil de dominio completa, 25 workflows de CI/gates especializados y una arquitectura de seguridad (privilege provenance, fail-closed identity assurance, padrón congelado) ya implementada con tests dedicados.

La auditoría ejecutó build/typecheck/lint/tests reales sobre todo el monorepo (no solo lectura de código) y encontró:

| Severidad | Hallazgos | Estado |
|---|---|---|
| **P0 — fragilidad de suite de tests** | 1 (causaba 270 tests / 18 suites en fallo en cascada bajo ciertas condiciones de entorno) | ✅ Corregido |
| **P1 — drift de arquitectura vs. contrato documentado** | 1 (dependencias GraphQL/Apollo no usadas, contradiciendo el contrato "REST-only" de `CLAUDE.md`) | ✅ Corregido |
| **P2 — limpieza de código muerto / lint** | 8 (imports/variables/directivas no usadas) | ✅ Corregido |
| **P2 — ruido de configuración de test** | 1 (warning de deprecación `pytest-asyncio`) | ✅ Corregido |

No se encontraron errores de `tsc --noEmit` en ningún workspace, ni fallos en la suite de contratos Solidity (53/53), ni violaciones observables de los invariantes P0 de gobernanza/identidad descritos en `CLAUDE.md` y `docs/security/*`.

---

## 2. Método

Se instalaron dependencias reales (`pnpm install --frozen-lockfile`, entorno Python vía `venv` + `pip install -r requirements.txt`) y se ejecutaron, sin mocks de resultado:

- `pnpm typecheck` (turbo, 8 paquetes) y typecheck aislado por app (`api`, `web`, `mobile`) para descartar falsos negativos por cancelación de tareas en `turbo`.
- `pnpm lint` (ESLint en `api`/`web`, `tsc --noEmit` en `mobile`, `ruff` en `ai`).
- `pnpm test` en `apps/api` (Jest, 116 suites) — dos corridas, con y sin `NODE_ENV` heredado del shell, para verificar determinismo.
- `mypy .`, `ruff check .`, `pytest -q` en `apps/ai` (87 tests).
- `hardhat test` en `contracts/` (53 tests, Solidity 0.8.25, EVM cancun).
- Lectura dirigida de `governance.vote-ledger.ts`, `config.ts` (fail-closed de `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`), y los documentos `PRIVILEGE_PROVENANCE_HARDENING.md` / `DEPENDENCY_EXCEPTIONS.md` contra el código real.

---

## 3. Hallazgos y correcciones aplicadas

### 3.1 [P0] Regresión de fiabilidad en la suite de `apps/api` — 270 tests / 18 suites fallando en cascada

**Causa raíz:** `src/__tests__/setup.ts` fijaba `process.env.NODE_ENV ??= 'test'` (solo si estaba `undefined`). `apps/api/src/app.ts` decide con `config.NODE_ENV !== 'test'` si registra `@fastify/rate-limit` contra el cliente Redis real. Cuando el proceso hereda un `NODE_ENV` ya definido por el shell/runner (p. ej. `development`), ese guard deja de activarse: el plugin de rate-limit intenta construir su `RedisStore` contra un cliente Redis no disponible en el entorno de test, y **toda** la suite que llama a `buildApp()` falla con un error de infraestructura no relacionado (`this.redis.defineCommand is not a function`) que enmascara por completo cualquier regresión real subyacente — incluyendo el test P0 de `governance.identity-assurance.test.ts` (padrón electoral congelado).

**Riesgo:** esto no es solo un problema de este sandbox. Cualquier runner de CI, imagen base Docker, o pipeline que exporte `NODE_ENV` antes de invocar `pnpm test` (patrón común) haría que la suite completa de `apps/api` fallara en bloque de forma no diagnosticable a simple vista, o — peor — que si alguna herramienta suprime el código de salida, la ausencia de señal real pase desapercibida.

**Corrección:** `process.env.NODE_ENV = 'test'` (asignación forzada, no condicional) en `apps/api/src/__tests__/setup.ts`. El resto de variables (`DATABASE_URL`, `REDIS_URL`, etc.) conserva `??=` deliberadamente, porque ahí sí es válido que CI/staging inyecte infraestructura real.

**Verificación:** re-ejecución de `pnpm test` en `apps/api` con y sin `NODE_ENV=development` heredado → **1099 passed, 0 failed, 15 skipped** en ambos casos (antes: 270 failed bajo la condición de entorno afectada).

### 3.2 [P1] Dependencias GraphQL/Apollo sin uso — drift contra el contrato de transporte documentado

`apps/web/package.json` declaraba `@apollo/client` y `graphql` como dependencias de producción. `CLAUDE.md` y `docs/architecture/ARCHITECTURE.md` establecen explícitamente: *"No existe un gateway GraphQL/Apollo Federation operativo... GraphQL no debe presentarse como la interfaz canónica actual"*. Una búsqueda exhaustiva (`ApolloClient`, `useQuery`+`gql`, imports de `graphql`) en `apps/web/**/*.{ts,tsx}` no encontró **ningún** uso real.

**Riesgo:** además del peso muerto en el bundle/instalación, esta clase de drift es exactamente la que `CLAUDE.md` pide prevenir — una dependencia sin uso sugiere (incorrectamente) que existe una segunda vía de datos activa, lo cual puede inducir a un futuro agente o desarrollador a construir sobre un contrato que no existe.

**Corrección:** eliminadas ambas entradas de `apps/web/package.json`. `pnpm lint`/`pnpm typecheck` en `apps/web` siguen en verde.

### 3.3 [P2] Limpieza de lint (8 items)

Todos eran advertencias (`0 errores` en ambos linters antes y después), pero se corrigieron para dejar el gate de lint verdaderamente limpio en vez de "verde con ruido":

- `apps/api/src/modules/billing/mercadopago.provider.ts`: import de tipo `BillingCycle` sin uso.
- `apps/api/src/modules/identity/__tests__/identity.service.test.ts`: `getOwnDIDDocument` importado sin uso.
- `apps/api/src/modules/legal/legal.schema.ts`: `URGENCY_LEVELS` importado sin uso.
- `apps/web/app/dashboard/legal/[id]/page.tsx`: constante `URGENCY_BADGE` duplicada y nunca referenciada (ya existe `URGENCY_COLOR`, que sí se usa).
- `apps/web/app/dashboard/proposals/[id]/page.tsx`: función `formatDate` muerta, superada por `formatShortDate` (que sí se usa en las 3 posiciones donde se renderizan fechas — se verificó que no hay ninguna fecha sin formatear en pantalla).
- `apps/web/app/dashboard/legal/new/page.tsx`: import `ArrowLeft` de `lucide-react` sin uso.
- `apps/web/app/dashboard/identity/page.tsx` y `apps/web/app/dashboard/reports/new/page.tsx`: directivas `eslint-disable` obsoletas (la regla que suprimían ya no se dispara ahí).

**No corregido intencionalmente:** el warning restante en `DashboardIdentityProvider.tsx:266` (`react-hooks/exhaustive-deps` sobre `domainSequence.current`) es un falso positivo conocido de esa regla contra el patrón de "contador de generación mutable para cancelar requests en vuelo" — el valor *debe* leerse en vivo en el cleanup, no capturarse en un snapshot, o se rompería la cancelación de requests obsoletos. Se documenta aquí en vez de forzar un cambio que degradaría el comportamiento correcto. Igual con el warning de `eslint.config.mjs` (exportar el array de config con nombre) — puramente estético, sin riesgo, se deja fuera de alcance de esta auditoría para no tocar el propio linter sin necesidad.

### 3.4 [P3] Nota — drift de peer dependencies en `apps/mobile` (no corregido, fuera de alcance)

Al regenerar `pnpm-lock.yaml` tras 3.2, `pnpm install` reportó peer dependencies no satisfechas preexistentes en `apps/mobile`: `react-native-reanimated@4.6.0` espera `react-native-worklets@0.12.x` (instalado `0.10.4`), y `react-dom@18.3.1`/`@types/react-dom@18.3.7` esperan React 18 mientras el workspace de mobile resuelve React `19.2.3`. No es una regresión de esta auditoría — ya existía — y `pnpm typecheck`/`pnpm lint` en `apps/mobile` pasan igualmente porque son warnings de resolución, no errores duros. Se deja registrado como candidato de Fase 8 (endurecimiento continuo): alinear las versiones de React/worklets declaradas en `apps/mobile/package.json` con lo que Expo SDK 57 realmente resuelve, para que `pnpm install` quede sin advertencias de peers.

### 3.5 [P2] Warning de deprecación en `apps/ai`

`pytest-asyncio` advertía sobre `asyncio_default_fixture_loop_scope` sin definir. Se fijó explícitamente a `function` en `apps/ai/pytest.ini` para evitar un cambio de comportamiento silencioso en una futura versión de la librería.

---

## 4. Verificación post-corrección (estado final de esta auditoría)

| Comando | Resultado |
|---|---|
| `pnpm typecheck` (api, web, mobile, types — aislados) | ✅ 0 errores |
| `pnpm lint` | ✅ 0 errores, 2 warnings intencionales (ver 3.3) |
| `pnpm test` — `apps/api` (Jest) | ✅ 1099 passed / 0 failed / 15 skipped |
| `mypy .` / `ruff check .` — `apps/ai` | ✅ 0 errores |
| `pytest -q` — `apps/ai` | ✅ 87 passed / 0 warnings |
| `hardhat test` — `contracts/` | ✅ 53 passed |

No se detectaron violaciones de los invariantes P0 auditados puntualmente: `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` sigue siendo fail-closed por defecto (`''` → allowlist vacía) en `apps/api/src/config.ts`, y `governance.vote-ledger.ts` conserva el diseño de padrón congelado, nullifiers opacos, y anulación de participación delegada por voto directo sin doble conteo, exactamente como describe `docs/governance/GOVERNANCE.md`.

---

## 5. Hoja de ruta hacia el 100% (`CERTIFIED FOR MARKET RELEASE`)

`MARKET_RELEASE_COMPLETION.md` ya separa el trabajo en automatizable-por-repositorio (`A`) vs. operador/externo (`B`). La sección `A` está, a la fecha de esta auditoría, prácticamente cerrada de extremo a extremo. Lo que sigue proyecta esa misma separación en **fases con hitos verificables**, asumiendo que ningún ítem se marca `CERTIFIED` sin evidencia observada (no por presencia de código).

### Fase 8 — Endurecimiento continuo de repositorio (en progreso permanente, sin bloquear release)

Objetivo: mantener el gate `A` en verde real, no solo en verde de CI.

- [x] Typecheck/lint/test limpios en los 8 paquetes del workspace (esta auditoría).
- [x] Suite de test de `apps/api` determinista independiente del `NODE_ENV` heredado del entorno de ejecución (esta auditoría).
- [x] Sin drift de dependencias declaradas-pero-no-usadas en `apps/web` (esta auditoría; recomendable repetir este chequeo — `depcheck`/`knip` — en cada PR grande de dependencias).
- [ ] Investigar el warning de Jest *"A worker process has failed to exit gracefully"* en `apps/api` (no bloquea CI hoy, pero indica un handle — probablemente Redis/temporizador — sin `unref()`/cierre explícito en algún test; puede esconder fugas de conexión en producción bajo carga sostenida).
- [ ] Descomponer los componentes/rutas más grandes de `apps/web` (dashboard/legal/community/identity) detrás de contratos de API estables, según ya anota `docs/CURRENT_STATE.md §8`.
- [ ] Presupuesto de bundle/activos estáticos + pipeline de compresión explícito.
- [ ] Ampliar cobertura Golden E2E y contratos de fuente donde la deuda restante lo permita.

**Criterio de salida:** cada PR que toque `apps/web`/`apps/api`/`apps/ai` sigue corriendo limpio con los mismos comandos usados en esta auditoría, sin regresiones nuevas de tipo "verde con ruido".

### Fase 9 — Propiedad y firma móvil (bloqueada por operador, `MARKET_RELEASE_COMPLETION.md §B2`)

- [ ] Vincular proyecto EAS real (`EAS_PROJECT_ID`) y variables de ambiente `EXPO_PUBLIC_API_URL` reales por perfil.
- [ ] Cuentas Apple Developer / Google Play Console, identidades de firma (Play App Signing, certificados iOS).
- [ ] Google Maps key de producción restringida a `com.ctgone.verticeos` + SHA-1 real.
- [ ] Credenciales push APNs/FCM/EAS.
- [ ] Build firmado representativo Android + iOS.

**Criterio de salida:** builds firmados generables de forma repetible desde `main`, sin secretos versionados (el gate `Security Scan` ya bloquea esto).

### Fase 10 — Certificación en dispositivo físico (`§B3`)

- [ ] Smoke test completo (auth, territorio, GPS, cámara/media, push foreground/background, deep links, Community, Workflows, Identity Assurance, Crowdfunding, borrado de cuenta) en al menos un dispositivo Android y uno iOS de producción representativa.

**Criterio de salida:** checklist de `§B3` firmado con evidencia (capturas/logs), no solo "compila".

### Fase 11 — Certificación de proveedores externos (`§B4`)

- [ ] Veriff: cuenta productiva, webhook autenticado, canario de decisión real.
- [ ] Cloudflare Images: canario de subida/entrega/purga desde dispositivo físico.
- [ ] Mercado Pago: checkout acotado real, webhook autenticado, settlement y refund verificados.
- [ ] Wompi/BRE-B: acceso productivo a Pagos a Terceros, canario de payout acotado, conciliación bancaria.

**Criterio de salida:** cada proveedor tiene su propio canario verde en el SHA de release exacto — nunca inferido desde la sola presencia del adapter en código.

### Fase 12 — Aprobación legal/comercial (`§B5`)

- [ ] Términos, Política de Privacidad y Habeas Data (Colombia), Guías Comunitarias, términos de crowdfunding/comisiones/reembolsos, divulgaciones KYC/KYB/payout, dueño de soporte/incident-response, caracterización legal de la gobernanza cívica/consultiva.

**Criterio de salida:** aprobación explícita registrada, no un borrador en el repositorio.

### Fase 13 — Publicación en tiendas (`§B6`)

- [ ] App Store Connect (listing, privacy labels, TestFlight, revisión) y Google Play (Data Safety, content rating, testing cerrado/abierto, revisión de producción).

**Criterio de salida:** aprobación de ambas tiendas sobre el build firmado de la Fase 9-10.

### Fase 14 — Certificación de release final

Solo cuando **todas** las filas de la matriz de `MARKET_RELEASE_COMPLETION.md §C` estén en `PASS`/`APPROVED` para el mismo SHA exacto — CI, SAST, Golden E2E/Financial/Governance, Production Hardening, canarios de proveedor, smoke físico, aprobación legal y de tiendas — el release puede describirse como `CERTIFIED FOR MARKET RELEASE`. Antes de eso, usar siempre los estados explícitos (`IMPLEMENTED` / `INTEGRATED` / `DEPLOYED` / `READY` / `CERTIFIED`) y nunca un "100%" genérico, tal como exige `docs/CURRENT_STATE.md §10`.

---

## 6. Nota de alcance

Esta auditoría fue de **código y build real** (no solo lectura estática): todo lo reportado como "✅" fue observado ejecutando la herramienta correspondiente en este mismo entorno, no inferido de la documentación. Las fases 9–13 dependen de credenciales, cuentas y aprobaciones que ningún agente de este repositorio puede generar ni simular — eso es exactamente lo que `MARKET_RELEASE_COMPLETION.md` ya marcaba como frontera humana obligatoria, y esta auditoría no encontró ningún caso donde el código intente saltarse esa frontera (p. ej., ningún fallback que simule certificación externa).

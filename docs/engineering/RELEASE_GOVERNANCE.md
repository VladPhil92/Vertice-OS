# VÉRTICE OS — Golden Main & Release Governance

Estado: **normativo para desarrollo y release**.

## 1. Principio rector

`Código presente` no equivale a `release certificado`.

Una capacidad solo puede describirse como productiva cuando existe evidencia del SHA exacto que atraviesa todos los gates aplicables.

## 2. Estados canónicos

Toda capacidad sensible o dependiente de terceros debe usar uno de estos estados:

- `IMPLEMENTED`: existe contrato ejecutable en el repositorio.
- `INTEGRATED`: existe integración de código, pero todavía depende de infraestructura/credenciales/evidencia externa.
- `DEPLOYED`: el artefacto del SHA exacto está desplegado en un target identificado.
- `READY`: health/readiness y smoke tests relevantes son satisfactorios.
- `CERTIFIED`: además de `READY`, los canaries o certificaciones externas aplicables son satisfactorios.
- `DEGRADED`: está operativa con capacidad reducida conocida.
- `BLOCKED`: un gate obligatorio impide activación o recaudo.
- `DISABLED`: feature flag o política de release mantiene la capacidad apagada.

Nunca convertir `IMPLEMENTED` o `INTEGRATED` en `READY` por inferencia.

## 3. Golden Main

`main` representa únicamente cambios que han pasado revisión y checks obligatorios. Debe configurarse en GitHub con protección de rama o ruleset equivalente.

Configuración mínima requerida:

1. Pull request obligatorio antes de merge.
2. Al menos una aprobación para cambios R2/R3 cuando exista más de un maintainer autorizado.
3. Require conversation resolution.
4. Required status checks sobre los contratos activos del repositorio.
5. Branch must be up to date before merge, salvo decisión explícita documentada por limitación operativa.
6. Bloquear force-push.
7. Bloquear borrado de `main`.
8. Restringir bypass administrativo al mínimo.
9. Mantener CODEOWNERS activo para límites sensibles.

Mientras el repositorio tenga un único maintainer, CODEOWNERS sigue siendo útil como frontera explícita de responsabilidad, aunque la aprobación independiente deba evolucionar con el equipo.

## 4. Clasificación de riesgo de PR

### R0
Documentación o cambios sin efecto de runtime.

### R1
Cambios funcionales reversibles sin dinero, autoridad, identidad fuerte ni migraciones de riesgo.

### R2
Autenticación, autorización, sesiones, migraciones, workflows críticos, infraestructura o integraciones externas.

### R3
Dinero, KYC/KYB, identity assurance, autoridad cívica, gobernanza/voto, secretos, borrado/destrucción de datos o cualquier operación irreversible de alto impacto.

R2/R3 exigen rollback explícito, observabilidad, pruebas del journey afectado e invariantes documentadas.

## 5. Required checks baseline

La protección de `main` debe exigir, como mínimo y mientras los nombres actuales existan:

- `Calidad de Código`
- `Tests`
- `Security Scan`
- `Build` cuando el workflow aplique al evento/branch
- `Golden Main Governance Contract`

Los contratos especializados deben añadirse como required checks cuando afecten el alcance del release, por ejemplo:

- Dashboard Browser Release Gate
- Frontend Runtime Contract
- Railway Runtime Contract
- Identity Provider Certification
- Federation Release Gate
- Contracts
- Semgrep Community SAST

No se debe hacer obligatorio un check que por diseño no se crea para todos los PR; primero debe ajustarse su trigger o definirse una regla de alcance estable.

## 6. Gate de merge

Un PR puede fusionarse cuando:

1. el alcance y risk class están declarados;
2. CODEOWNERS/review aplicable está satisfecho;
3. checks obligatorios del SHA exacto están verdes;
4. no quedan conversaciones críticas abiertas;
5. migraciones tienen estrategia forward/rollback cuando aplica;
6. R2/R3 incluyen evidencia de autorización, idempotencia y fail-closed cuando corresponde;
7. documentación operacional cambia junto con el contrato cuando es necesario.

## 7. Gate de release

Un merge exitoso no implica release exitoso. La certificación requiere, en orden:

1. **SOURCE** — SHA exacto identificado.
2. **CI** — checks requeridos satisfactorios.
3. **BUILD** — artefacto reproducible/identificable.
4. **DEPLOY** — deployment real iniciado/completado en target conocido.
5. **READINESS** — health/readiness satisfactorio.
6. **SMOKE/E2E** — journey crítico del cambio validado.
7. **EXTERNAL CANARY** — cuando depende de proveedor externo.
8. **CERTIFIED** — solo después de cumplir todos los gates aplicables.

Para crowdfunding/pagos, `CERTIFIED` exige además que los readiness graphs financieros permanezcan fail-closed y no existan bypasses de KYC/KYB, payout destination, provider readiness o reconciliación.

## 8. Rollback

Todo R2/R3 debe responder antes de merge:

- qué commit/artefacto se revierte;
- si una migración puede revertirse de forma segura;
- qué ocurre con operaciones in-flight;
- cómo se previene doble procesamiento;
- cómo se deshabilita la capacidad mediante feature flag/circuit breaker cuando exista;
- qué evidencia confirma recuperación.

## 9. Versionado y release notes

Mientras VÉRTICE siga en fase pre-GA se recomienda SemVer `0.x.y`:

- `0.x.0`: incremento funcional relevante o cambio de contrato.
- `0.x.y`: fix, hardening o mejora compatible.

Los releases deben referenciar el SHA certificado y resumir cambios por dominio, riesgos conocidos, migraciones y acciones manuales.

## 10. Acción administrativa pendiente

Este documento y el workflow de gobernanza pueden verificar que el contrato exista en código, pero **no pueden activar por sí solos la protección de rama**. La protección/ruleset de `main` debe habilitarse desde la configuración administrativa de GitHub y verificarse después mediante la API/UX de GitHub.

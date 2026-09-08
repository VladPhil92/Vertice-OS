## Objetivo

Describe el problema que resuelve este PR y el resultado observable esperado.

## Alcance

- [ ] Web / Dashboard
- [ ] API / datos
- [ ] Mobile
- [ ] IA
- [ ] Crowdfunding / pagos
- [ ] Identidad / seguridad
- [ ] Gobernanza / reputación
- [ ] Infraestructura / CI
- [ ] Documentación

## Risk class

Selecciona exactamente una:

- [ ] R0 — documentación o cambio sin efecto de runtime
- [ ] R1 — cambio funcional reversible, sin datos sensibles ni dinero
- [ ] R2 — autenticación, permisos, migraciones, workflows críticos o integraciones externas
- [ ] R3 — dinero, KYC/KYB, identidad cívica, autoridad, gobernanza/voto, secretos o cambios destructivos de datos

## Invariantes

Explica qué invariantes deben seguir siendo ciertos. Para R2/R3 incluye controles fail-closed, idempotencia, autorización y trazabilidad cuando apliquen.

## Evidencia de pruebas

- [ ] lint
- [ ] typecheck
- [ ] tests relevantes
- [ ] cobertura relevante
- [ ] build
- [ ] SAST / dependency scan aplicable
- [ ] migraciones verificadas si aplica
- [ ] E2E / smoke del journey afectado si aplica

Incluye enlaces o nombres de checks cuando existan.

## Release evidence

Código presente no equivale a release certificado.

- [ ] CI del SHA exacto en verde
- [ ] artefacto/build identificable
- [ ] deployment real confirmado si aplica
- [ ] `/health` y `/health/ready` confirmados si aplica
- [ ] smoke test post-deploy si aplica
- [ ] canary externo certificado si la feature depende de un tercero

Para capacidades que todavía no estén desplegadas, indica explícitamente `NOT DEPLOYED` o `BLOCKED`, nunca `READY` por inferencia.

## Seguridad y privacidad

- [ ] no introduce secretos en el repositorio
- [ ] no expone PII adicional sin necesidad
- [ ] respeta separación entre autenticación, reputación e identity assurance
- [ ] respeta autorización server-side y autoridad viva
- [ ] datos financieros y KYC/KYB no alteran reputación, ranking, voto o autoridad cívica

## Rollback

Describe el mecanismo concreto de reversión. Para R2/R3 incluye el impacto sobre datos/migraciones y cómo se evita corrupción o doble procesamiento.

## Observabilidad

¿Qué logs, métricas, alertas o audit events permiten detectar una regresión después del merge?

## Documentación

- [ ] README/CURRENT_STATE actualizado si cambió el contrato operativo
- [ ] runbook/arquitectura/ADR actualizado si aplica
- [ ] deuda o acción manual externa registrada explícitamente

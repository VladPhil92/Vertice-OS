# Phase 0 — Golden Main

Fecha de ejecución: **8 de septiembre de 2026**.

## Objetivo

Convertir `main` en una línea de integración gobernada, auditable y apta para soportar las siguientes fases de VÉRTICE OS sin normalizar merges directos, releases ambiguos ni declaraciones de producción basadas únicamente en código presente.

## Orden lógico aplicado

1. **Ownership** — declarar responsables de áreas sensibles mediante CODEOWNERS.
2. **PR contract** — exigir clasificación de riesgo, invariantes, evidencia, rollback y observabilidad.
3. **Release semantics** — separar estados `IMPLEMENTED`, `INTEGRATED`, `DEPLOYED`, `READY` y `CERTIFIED`.
4. **Executable governance** — verificar automáticamente que el contrato de gobernanza no desaparezca o sea degradado accidentalmente.
5. **Release notes** — preparar clasificación de cambios para releases trazables.
6. **Branch protection** — activar el control administrativo de `main` después del merge de esta fase.
7. **E2E baseline** — solo después de Golden Main iniciar la Fase 1 de journeys críticos.

## Entregables construidos

- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `.github/release.yml`
- `.github/workflows/governance-contract.yml`
- `scripts/verify-release-governance.mjs`
- `docs/engineering/RELEASE_GOVERNANCE.md`
- script raíz `pnpm governance:verify`

## Gate ejecutable

El workflow `Golden Main Governance Contract` verifica en cada PR/push relevante que existan los artefactos de gobernanza y que permanezcan los tokens contractuales mínimos de:

- ownership;
- risk classification;
- rollback;
- release evidence;
- required CI jobs;
- estados de release;
- límites de certificación.

Este gate no declara producción `READY` ni `CERTIFIED`.

## Acción administrativa obligatoria después del merge

GitHub debe configurar `main` mediante branch protection o ruleset equivalente. Como mínimo:

- require pull request;
- require conversation resolution;
- bloquear force-push;
- bloquear deletion;
- aplicar CODEOWNERS;
- exigir `Golden Main Governance Contract`;
- exigir los checks CI estables que se creen en todos los PR relevantes;
- limitar bypasses.

No activar como required un workflow condicional que no genere check en todos los PR del alcance, porque eso puede bloquear merges de forma permanente.

## Definition of Done — Fase 0

### Código / repositorio

- [x] rama de fase creada desde `main`;
- [x] CODEOWNERS creado;
- [x] PR contract creado;
- [x] release governance documentada;
- [x] contrato ejecutable creado;
- [x] workflow de gobernanza creado;
- [x] release note taxonomy creada;
- [x] comando local `pnpm governance:verify` añadido;
- [ ] checks del PR de esta fase verdes;
- [ ] merge a `main`;

### Administración externa

- [ ] branch protection/ruleset activado;
- [ ] required checks verificados contra nombres reales de GitHub;
- [ ] bypass policy revisada;

La Fase 0 se considera **code-complete** cuando el PR está verde y **operationally complete** solo cuando `main` aparezca protegida en GitHub.

# Siguiente fase — Phase 1: Golden E2E Journeys

La siguiente fase no debe introducir otro gran dominio funcional. Debe certificar recorridos verticales existentes.

## Orden P0 propuesto

1. **Auth + session lifecycle**
   - login web;
   - refresh;
   - logout/revocation;
   - role/authority revalidation.

2. **Citizen action loop**
   - crear acción;
   - adjuntar evidencia;
   - persistir;
   - reflejar dashboard/reputación sin escalaciones indebidas.

3. **Territorial report loop**
   - crear reporte georreferenciado;
   - validar PostGIS;
   - consultar superficie de mapa;
   - verificar eventos/notificaciones aplicables.

4. **Community → proposal → governance loop**
   - propuesta;
   - padrón/eligibility;
   - participación;
   - tally reconstruible;
   - prevención de doble influencia.

5. **Crowdfunding safe path**
   - readiness bloqueado cuando faltan providers;
   - activación permitida solo cuando todos los gates aplicables están satisfechos;
   - checkout idempotente;
   - webhook duplicate-safe;
   - reconciliación/refund/payout según entorno certificado.

6. **External identity path**
   - sesión/provider lifecycle;
   - webhook firmado;
   - replay protection;
   - ningún upgrade de civic identity assurance sin certificación válida.

## Regla de implementación

Cada journey P0 debe probar, cuando aplique:

`UI → API → autorización → persistencia → evento/audit → respuesta → estado visible final`.

Los tests deben fallar si un módulo queda solamente “implementado” pero no integrado de extremo a extremo.

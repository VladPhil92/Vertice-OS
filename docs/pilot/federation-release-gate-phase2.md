# CTG One Federation Release Gate — Phase II

> Pilot launch hardening · 6 de septiembre de 2026

## Objetivo

Convertir el acceso federado CTG One → VÉRTICE en un contrato de release verificable, no solamente en código disponible o configuración de infraestructura.

Esta fase complementa la sincronización productiva del secreto server-to-server entre CTG One y VÉRTICE. El secreto nunca se persiste en el repositorio ni se expone al navegador.

## Contrato certificado en CI

El workflow `.github/workflows/federation-release-gate.yml` construye el frontend en modo producción, inicia el servidor real de Next.js y ejecuta Chromium contra la aplicación compilada.

El gate cubre:

1. disponibilidad del CTA `Registrarse o ingresar con CTG One`;
2. ruta canónica `/auth/ctgone/start`;
3. callback PKCE con `state` válido;
4. intercambio únicamente por el gateway same-origin `/api/auth/ctgone/exchange`;
5. creación de la sesión local VÉRTICE después de un intercambio exitoso;
6. eliminación de `state` y `code_verifier` de `sessionStorage` después de su uso;
7. rechazo fail-closed de callbacks con `state` alterado;
8. ausencia de sesión local cuando el callback no supera la validación.

## Evidencia de fallo

Cuando el gate falla, GitHub Actions conserva por 14 días:

- resultados de Playwright;
- trazas/capturas disponibles;
- log del servidor Next.js de producción usado por la prueba.

Esto permite distinguir una regresión de UI, callback, sesión o routing del fallo de un proveedor externo.

## Límites

Este gate no sustituye el canary productivo real. Un código de autorización CTG One es de un solo uso y solo puede certificarse extremo a extremo mediante una sesión real del proveedor.

Por tanto, el estado correcto se expresa así:

- **contrato navegador/PKCE/sesión:** certificado automáticamente;
- **secreto server-to-server:** configurado en infraestructura, nunca en código;
- **canary real CTG One → VÉRTICE:** evidencia operacional separada;
- **civic identity assurance:** permanece independiente de la autenticación federada.

## Criterio de salida

La fase se considera cerrada cuando:

- el workflow pasa en el PR y en `main`;
- la build de producción completa;
- Chromium completa los casos válido y adversarial;
- no se genera sesión ante `state` inválido;
- un nuevo intento real de federación deja evidencia operacional satisfactoria en producción.

## Referencias

- `docs/integrations/CTG_ONE.md`
- `apps/web/app/auth/ctgone/`
- `apps/web/e2e/ctgone-auth.spec.ts`
- `.github/workflows/frontend-runtime-contract.yml`
- `.github/workflows/federation-release-gate.yml`

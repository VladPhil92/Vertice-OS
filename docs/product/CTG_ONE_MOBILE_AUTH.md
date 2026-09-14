# CTG One → VÉRTICE Mobile Auth Contract

## Objetivo
Permitir que la misma identidad CTG One usada en VÉRTICE Web inicie sesión en VÉRTICE Mobile sin crear una cuenta separada.

## Flujo real (BFF server-side PKCE)

El backend VÉRTICE actúa como boundary OAuth/BFF confidencial: genera y custodia el par PKCE, no el cliente móvil. Este patrón es más seguro que "PKCE en el cliente" y es el que corre en producción hoy — no documentar el inverso.

1. Mobile llama `POST /auth/mobile/ctgone/start` sin parámetros. El backend genera el par PKCE S256 (`code_verifier`/`code_challenge`) y lo custodia en Redis bajo un `transaction_id` opaco, con TTL de 10 minutos y consumo atómico de una sola vez (GET+DEL). El cliente nunca ve ni almacena el `code_verifier`.
2. El backend responde con `{ authorize_url, transaction_id, state, callback_uri: 'vertice://auth/ctgone/callback', expires_in }`. Mobile valida que `authorize_url` empiece por `https://` antes de abrirla y persiste `{ transaction_id, state, expiresAt }` localmente.
3. Mobile abre `authorize_url` en el navegador del sistema (`Linking.openURL`), no en un WebView embebido.
4. CTG One autentica al usuario y redirige al esquema nativo registrado `vertice://auth/ctgone/callback` (`app.json` → `scheme: "vertice"`), entregando `code` y `state` como parámetros del deep link.
5. La pantalla `app/auth/ctgone/callback.tsx` recoge `code`/`state` del deep link y llama `POST /auth/mobile/ctgone/exchange` con `{ code, state, transaction_id }` — nunca con `code_verifier`.
6. El backend recupera y borra atómicamente la transacción por `transaction_id`, valida que `state` coincida con el guardado, y ejecuta el mismo `exchangeCtgOneFederation` que usa el flujo web (`federation.service`) — misma resolución de identidad, mismo `citizen_id`, sin duplicar cuenta.
7. Mobile persiste únicamente `access_token`/`refresh_token` VÉRTICE en almacenamiento seguro; descarta la transacción pendiente tanto en éxito como en error.
8. `/auth/me` resuelve al mismo `citizen_id` usado por web, porque ambos flujos terminan en el mismo servicio de federación.

## Invariantes
- VÉRTICE Mobile nunca genera ni recibe el `code_verifier`, y nunca captura la contraseña CTG One en sus propios campos.
- Un `ctg_one_subject` no puede crear más de un `citizen_id` (misma lógica de resolución que web, vía `federation.service`).
- Cada `transaction_id` se consume una sola vez y expira a los 10 minutos; una segunda entrega del mismo código o transacción es rechazada.
- Si existe una cuenta VÉRTICE previa con identidad verificable compatible, se debe vincular mediante flujo explícito y seguro, no duplicar.
- Logout VÉRTICE revoca la sesión VÉRTICE local; el logout global CTG One debe ser una acción separada.

## UI
`Continuar con CTG One` es la acción federada principal. Debajo se mantiene el divisor `o usa tu cuenta VÉRTICE` y el login nativo como alternativa.

## Referencias de código
- Backend: `apps/api/src/modules/auth/mobile-federation.service.ts`
- Cliente: `apps/mobile/lib/ctgone.ts`, `apps/mobile/app/auth/ctgone/callback.tsx`
- Test de contrato: `apps/api/src/modules/auth/__tests__/mobile-auth-contract.test.ts`

Antes de modificar este flujo, leer el test de contrato — fija en código el comportamiento de PKCE server-side que este documento describe.
